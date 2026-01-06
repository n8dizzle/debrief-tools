/**
 * Google Sheets API client for syncing huddle data.
 * Uses Google Sheets API v4 with service account authentication.
 */

import { google, sheets_v4 } from 'googleapis';

interface SheetsCellMapping {
  [kpiSlug: string]: string; // e.g., "jobs-scheduled": "B7"
}

interface SheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  cellMappings: SheetsCellMapping;
}

interface SyncResult {
  success: boolean;
  values: Record<string, number | string | null>;
  errors: string[];
}

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the Google Sheets client with service account credentials
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
      console.warn('Google Sheets credentials not configured');
      return;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets client:', error);
    }
  }

  /**
   * Check if the client is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized && this.sheets !== null;
  }

  /**
   * Get values from a single range
   */
  async getValues(spreadsheetId: string, range: string): Promise<unknown[][] | null> {
    await this.initialize();
    if (!this.sheets) return null;

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || null;
    } catch (error) {
      console.error(`Failed to get values from ${range}:`, error);
      return null;
    }
  }

  /**
   * Get values from multiple ranges at once (batch)
   */
  async batchGetValues(
    spreadsheetId: string,
    ranges: string[]
  ): Promise<Record<string, unknown> | null> {
    await this.initialize();
    if (!this.sheets) return null;

    try {
      const response = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
      });

      const result: Record<string, unknown> = {};
      response.data.valueRanges?.forEach((vr, index) => {
        const value = vr.values?.[0]?.[0];
        result[ranges[index]] = value;
      });

      return result;
    } catch (error) {
      console.error('Failed to batch get values:', error);
      return null;
    }
  }

  /**
   * Sync targets from a Google Sheet
   * Returns KPI slug -> target value mapping
   */
  async syncTargets(config: SheetsConfig): Promise<SyncResult> {
    const errors: string[] = [];
    const values: Record<string, number | string | null> = {};

    if (!this.isConfigured()) {
      return {
        success: false,
        values: {},
        errors: ['Google Sheets client not configured'],
      };
    }

    // Build ranges from cell mappings
    const ranges = Object.entries(config.cellMappings).map(
      ([slug, cell]) => `${config.sheetName}!${cell}`
    );

    const rawValues = await this.batchGetValues(config.spreadsheetId, ranges);
    if (!rawValues) {
      return {
        success: false,
        values: {},
        errors: ['Failed to fetch values from spreadsheet'],
      };
    }

    // Map results back to KPI slugs
    for (const [slug, cell] of Object.entries(config.cellMappings)) {
      const range = `${config.sheetName}!${cell}`;
      const rawValue = rawValues[range];

      if (rawValue === undefined || rawValue === null || rawValue === '') {
        values[slug] = null;
        errors.push(`No value found for ${slug} at ${cell}`);
      } else {
        // Parse the value - handle currency, percentages, etc.
        values[slug] = this.parseValue(rawValue);
      }
    }

    return {
      success: errors.length === 0,
      values,
      errors,
    };
  }

  /**
   * Sync actuals from a Google Sheet (for departments like Warehouse, Finance)
   */
  async syncActuals(
    config: SheetsConfig,
    date: string
  ): Promise<SyncResult> {
    // For now, actuals sync works the same as targets
    // In future, we might need date-specific logic
    return this.syncTargets(config);
  }

  /**
   * Parse a raw cell value to a number or string
   */
  private parseValue(rawValue: unknown): number | string | null {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    const strValue = String(rawValue).trim();

    // Handle "Yes"/"No" booleans
    if (strValue.toLowerCase() === 'yes') return 1;
    if (strValue.toLowerCase() === 'no') return 0;

    // Remove currency formatting ($, commas)
    const cleanedValue = strValue.replace(/[$,]/g, '');

    // Handle percentages
    if (cleanedValue.endsWith('%')) {
      const numValue = parseFloat(cleanedValue.slice(0, -1));
      return isNaN(numValue) ? strValue : numValue;
    }

    // Try to parse as number
    const numValue = parseFloat(cleanedValue);
    if (!isNaN(numValue)) {
      return numValue;
    }

    // Return as string if not a number
    return strValue;
  }

  /**
   * Get the current date's column in a daily tracking sheet
   * Assumes columns are dates starting from some column (e.g., B, C, D...)
   */
  async findDateColumn(
    spreadsheetId: string,
    sheetName: string,
    date: string,
    headerRow: number = 1,
    startColumn: string = 'B',
    maxColumns: number = 31
  ): Promise<string | null> {
    await this.initialize();
    if (!this.sheets) return null;

    const startColNum = startColumn.charCodeAt(0) - 64; // A=1, B=2, etc.
    const endColNum = startColNum + maxColumns - 1;
    const endCol = String.fromCharCode(64 + endColNum);

    const range = `${sheetName}!${startColumn}${headerRow}:${endCol}${headerRow}`;

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const headers = response.data.values?.[0] || [];
      const targetDate = new Date(date + 'T00:00:00');

      for (let i = 0; i < headers.length; i++) {
        const headerValue = headers[i];
        if (headerValue) {
          // Try to parse header as date
          const headerDate = new Date(headerValue);
          if (!isNaN(headerDate.getTime())) {
            // Compare dates (ignoring time)
            if (
              headerDate.getFullYear() === targetDate.getFullYear() &&
              headerDate.getMonth() === targetDate.getMonth() &&
              headerDate.getDate() === targetDate.getDate()
            ) {
              return String.fromCharCode(startColumn.charCodeAt(0) + i);
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find date column:', error);
      return null;
    }
  }
}

// Singleton instance
let _client: GoogleSheetsClient | null = null;

export function getGoogleSheetsClient(): GoogleSheetsClient {
  if (!_client) {
    _client = new GoogleSheetsClient();
  }
  return _client;
}

/**
 * Helper to get the spreadsheet ID from a URL
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
