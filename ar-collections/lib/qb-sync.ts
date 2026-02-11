/**
 * QuickBooks Sync Orchestration
 *
 * Handles syncing payments from QuickBooks and ServiceTitan,
 * and reconciling them to track undeposited payments.
 */

import { getQuickBooksClient, QBPayment } from './quickbooks';
import { getServerSupabase } from './supabase';
import { ServiceTitanClient, STPayment } from './servicetitan';

// ============================================
// TYPES
// ============================================

export interface QBSyncResult {
  success: boolean;
  syncLogId: string;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  matchesFound: number;
  stPaymentsFetched: number;
  stPaymentsCreated: number;
  errors: string | null;
}

export interface ReconciliationMatch {
  stPaymentId: number;
  qbPaymentId: string;
  confidence: number;
  matchReason: string;
}

// ============================================
// SYNC FUNCTIONS
// ============================================

/**
 * Run a full sync:
 * 1. Fetch payments from ServiceTitan (what technicians collected)
 * 2. Fetch payments from QB (what's in books)
 * 3. Match ST payments to QB payments
 * 4. Identify ST payments without QB matches (needs tracking)
 */
export async function runQBSync(): Promise<QBSyncResult> {
  const supabase = getServerSupabase();
  let syncLogId: string;

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('ar_qb_sync_log')
    .insert({
      sync_type: 'full',
      status: 'running',
    })
    .select('id')
    .single();

  if (logError || !syncLog) {
    console.error('[QB Sync] Failed to create sync log:', logError);
    throw new Error('Failed to create sync log');
  }

  syncLogId = syncLog.id;

  let stPaymentsFetched = 0;
  let stPaymentsCreated = 0;

  try {
    // =========================================
    // STEP 1: Fetch ServiceTitan Payments
    // =========================================
    console.log('[Sync] Fetching ServiceTitan payments...');
    const stClient = new ServiceTitanClient();
    const stPayments = await stClient.getRecentPayments({ pageSize: 100 });
    stPaymentsFetched = stPayments.length;
    console.log(`[Sync] Found ${stPayments.length} ST payments`);

    // Get customer names for ST payments (needed for matching)
    const customerCache = new Map<number, string>();
    for (const payment of stPayments) {
      if (payment.customerId && !customerCache.has(payment.customerId)) {
        const customer = await stClient.getCustomer(payment.customerId);
        if (customer) {
          customerCache.set(payment.customerId, customer.name);
        }
      }
    }

    // Upsert ST payments into reconciliation table
    let stSkipped = 0;
    let stExists = 0;
    for (const payment of stPayments) {
      const customerName = payment.customerId ? customerCache.get(payment.customerId) : null;
      // Try multiple date fields - ST API uses different fields
      const paymentDate = payment.date ||
        payment.paidOn ||
        payment.appliedOn ||
        payment.createdOn;

      if (!paymentDate) {
        console.warn(`[Sync] ST Payment ${payment.id} has no date, skipping. Fields:`, Object.keys(payment));
        stSkipped++;
        continue;
      }

      // Log first payment to see structure
      if (stPaymentsCreated === 0 && stExists === 0 && stSkipped === 0) {
        console.log('[Sync] Sample ST payment:', JSON.stringify(payment, null, 2));
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('ar_payment_reconciliation')
        .select('id, qb_payment_id, match_status')
        .eq('st_payment_id', payment.id)
        .single();

      if (!existing) {
        // Create new reconciliation record for ST payment
        const insertData = {
          st_payment_id: payment.id,
          st_invoice_id: payment.invoiceId || null,
          st_customer_id: payment.customerId || null,
          amount: payment.amount,
          payment_date: paymentDate.split('T')[0],
          payment_type: payment.type?.name || 'Unknown',
          customer_name: customerName || null,
          match_status: 'st_only',
          match_confidence: 0,
          is_deposited: false,
        };

        const { error: insertError } = await supabase
          .from('ar_payment_reconciliation')
          .insert(insertData);

        if (insertError) {
          console.error(`[Sync] Failed to insert ST payment ${payment.id}:`, insertError);
          console.error('[Sync] Insert data was:', JSON.stringify(insertData));
        } else {
          stPaymentsCreated++;
        }
      } else {
        stExists++;
      }
    }

    console.log(`[Sync] ST payments - created: ${stPaymentsCreated}, existing: ${stExists}, skipped (no date): ${stSkipped}`);

    // =========================================
    // STEP 2: Fetch QuickBooks Payments
    // =========================================
    const client = await getQuickBooksClient();
    let qbCreated = 0;
    let qbUpdated = 0;
    let qbPaymentsCount = 0;

    if (client.isConnected()) {
      console.log('[Sync] Fetching QuickBooks payments...');

      // Fetch payments from Undeposited Funds
      const undepositedPayments = await client.getPaymentsInUndepositedFunds();
      console.log(`[Sync] Found ${undepositedPayments.length} payments in Undeposited Funds`);

      // Also fetch recent payments (last 30 days) to catch deposited ones
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      const recentPayments = await client.getAllPayments(startDate);
      console.log(`[Sync] Found ${recentPayments.length} recent QB payments`);

      // Combine and dedupe payments
      const paymentMap = new Map<string, QBPayment>();
      for (const payment of [...undepositedPayments, ...recentPayments]) {
        paymentMap.set(payment.Id, payment);
      }
      const allQBPayments = Array.from(paymentMap.values());
      qbPaymentsCount = allQBPayments.length;

      console.log(`[Sync] Total unique QB payments: ${qbPaymentsCount}`);

      // Get Undeposited Funds account ID for comparison
      const undepositedFundsId = await client.getUndepositedFundsAccountId();

      // Upsert QB payments into cache
      for (const payment of allQBPayments) {
        const isDeposited = payment.DepositToAccountRef?.value !== undepositedFundsId;

        const paymentData = {
          qb_payment_id: payment.Id,
          qb_customer_id: payment.CustomerRef?.value || null,
          qb_customer_name: payment.CustomerRef?.name || null,
          payment_date: payment.TxnDate,
          amount: payment.TotalAmt,
          payment_method: payment.PaymentMethodRef?.name || null,
          payment_method_ref: payment.PaymentMethodRef?.value || null,
          deposit_to_account_ref: payment.DepositToAccountRef?.value || null,
          deposit_to_account_name: payment.DepositToAccountRef?.name || null,
          is_deposited: isDeposited,
          memo: payment.PrivateNote || null,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from('ar_qb_payments')
          .select('id')
          .eq('qb_payment_id', payment.Id)
          .single();

        if (existing) {
          await supabase
            .from('ar_qb_payments')
            .update(paymentData)
            .eq('qb_payment_id', payment.Id);
          qbUpdated++;
        } else {
          await supabase
            .from('ar_qb_payments')
            .insert(paymentData);
          qbCreated++;
        }
      }

      console.log(`[Sync] QB payments - Created ${qbCreated}, Updated ${qbUpdated}`);
    } else {
      console.log('[Sync] QuickBooks not connected, skipping QB sync');
    }

    // =========================================
    // STEP 3: Match ST payments to QB payments
    // =========================================
    const matchesFound = await matchSTtoQBPayments();

    // Update sync log
    await supabase
      .from('ar_qb_sync_log')
      .update({
        completed_at: new Date().toISOString(),
        records_fetched: qbPaymentsCount,
        records_created: qbCreated,
        records_updated: qbUpdated,
        matches_found: matchesFound,
        status: 'completed',
      })
      .eq('id', syncLogId);

    console.log(`[Sync] Completed. Matches found: ${matchesFound}`);

    return {
      success: true,
      syncLogId,
      recordsFetched: qbPaymentsCount,
      recordsCreated: qbCreated,
      recordsUpdated: qbUpdated,
      matchesFound,
      stPaymentsFetched,
      stPaymentsCreated,
      errors: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Error:', errorMessage);

    // Update sync log with error
    await supabase
      .from('ar_qb_sync_log')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: errorMessage,
      })
      .eq('id', syncLogId);

    return {
      success: false,
      syncLogId,
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      matchesFound: 0,
      stPaymentsFetched,
      stPaymentsCreated,
      errors: errorMessage,
    };
  }
}

/**
 * Match ST payments to QB payments
 * This identifies:
 * - ST payments with QB matches (reconciled)
 * - ST payments without QB matches (needs tracking - technician collected but not in QB)
 */
async function matchSTtoQBPayments(): Promise<number> {
  const supabase = getServerSupabase();

  // Get ST-only payments (not yet matched to QB)
  const { data: stOnlyPayments } = await supabase
    .from('ar_payment_reconciliation')
    .select('*')
    .eq('match_status', 'st_only')
    .order('payment_date', { ascending: false });

  if (!stOnlyPayments || stOnlyPayments.length === 0) {
    console.log('[Matching] No ST-only payments to match');
    return 0;
  }

  // Get all QB payments from cache
  const { data: qbPayments } = await supabase
    .from('ar_qb_payments')
    .select('*')
    .order('payment_date', { ascending: false });

  if (!qbPayments || qbPayments.length === 0) {
    console.log('[Matching] No QB payments to match against');
    return 0;
  }

  // Get already-matched QB payment IDs
  const { data: matchedRecords } = await supabase
    .from('ar_payment_reconciliation')
    .select('qb_payment_id')
    .not('qb_payment_id', 'is', null);

  const matchedQBIds = new Set((matchedRecords || []).map(r => r.qb_payment_id));

  // Available QB payments (not yet matched)
  const availableQBPayments = qbPayments.filter(qb => !matchedQBIds.has(qb.qb_payment_id));
  console.log(`[Matching] ${availableQBPayments.length} available QB payments to match`);

  let matchesFound = 0;

  for (const stPayment of stOnlyPayments) {
    // Find potential QB matches
    const potentialMatches = availableQBPayments.filter(qb => {
      // Amount must match within $0.01
      const amountMatch = Math.abs(qb.amount - stPayment.amount) < 0.01;
      if (!amountMatch) return false;

      // Date within 7 days
      const stDate = new Date(stPayment.payment_date);
      const qbDate = new Date(qb.payment_date);
      const daysDiff = Math.abs((stDate.getTime() - qbDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 7) return false;

      // Customer name similarity (if available)
      if (stPayment.customer_name && qb.qb_customer_name) {
        const stName = stPayment.customer_name.toLowerCase().trim();
        const qbName = qb.qb_customer_name.toLowerCase().trim();

        // Check if names match
        if (stName === qbName) return true;
        if (stName.includes(qbName) || qbName.includes(stName)) return true;

        // Check name parts
        const stParts = stName.split(/\s+/);
        const qbParts = qbName.split(/\s+/);

        for (const stPart of stParts) {
          for (const qbPart of qbParts) {
            if (stPart.length > 2 && qbPart.length > 2 &&
              (stPart === qbPart || stPart.includes(qbPart) || qbPart.includes(stPart))) {
              return true;
            }
          }
        }

        // Names don't match - less confident
        return daysDiff <= 3; // Only match if date is very close
      }

      // No customer name to compare - match by amount and date only
      return daysDiff <= 3;
    });

    if (potentialMatches.length === 1) {
      // Single match - confident
      const qbMatch = potentialMatches[0];
      const confidence = calculateSTtoQBConfidence(stPayment, qbMatch);

      await supabase
        .from('ar_payment_reconciliation')
        .update({
          qb_payment_id: qbMatch.qb_payment_id,
          match_status: confidence >= 0.8 ? 'matched' : 'pending_review',
          match_confidence: confidence,
          matched_at: confidence >= 0.8 ? new Date().toISOString() : null,
          is_deposited: qbMatch.is_deposited,
          deposit_date: qbMatch.is_deposited ? qbMatch.payment_date : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stPayment.id);

      // Remove from available pool
      const idx = availableQBPayments.findIndex(qb => qb.qb_payment_id === qbMatch.qb_payment_id);
      if (idx > -1) availableQBPayments.splice(idx, 1);

      matchesFound++;
      console.log(`[Matching] Matched ST#${stPayment.st_payment_id} to QB#${qbMatch.qb_payment_id} (confidence: ${confidence.toFixed(2)})`);
    } else if (potentialMatches.length > 1) {
      // Multiple matches - needs manual review
      console.log(`[Matching] ST#${stPayment.st_payment_id} has ${potentialMatches.length} potential QB matches - needs review`);
    }
    // No matches = stays as st_only (technician collected but not in QB - needs tracking)
  }

  return matchesFound;
}

/**
 * Calculate match confidence between ST payment and QB payment
 */
function calculateSTtoQBConfidence(
  stPayment: { amount: number; customer_name: string | null; payment_date: string },
  qbPayment: { amount: number; qb_customer_name: string | null; payment_date: string }
): number {
  let confidence = 0;

  // Amount match (40% weight) - exact match required at this point
  if (Math.abs(stPayment.amount - qbPayment.amount) < 0.01) {
    confidence += 0.4;
  }

  // Customer name match (40% weight)
  if (stPayment.customer_name && qbPayment.qb_customer_name) {
    const stName = stPayment.customer_name.toLowerCase().trim();
    const qbName = qbPayment.qb_customer_name.toLowerCase().trim();

    if (stName === qbName) {
      confidence += 0.4;
    } else if (stName.includes(qbName) || qbName.includes(stName)) {
      confidence += 0.3;
    } else {
      // Check name parts
      const stParts = stName.split(/\s+/);
      const qbParts = qbName.split(/\s+/);
      let partialMatches = 0;

      for (const stPart of stParts) {
        for (const qbPart of qbParts) {
          if (stPart.length > 2 && qbPart.length > 2 &&
            (stPart === qbPart || stPart.includes(qbPart) || qbPart.includes(stPart))) {
            partialMatches++;
          }
        }
      }

      if (partialMatches > 0) {
        confidence += Math.min(0.2 * partialMatches, 0.3);
      }
    }
  }

  // Date proximity (20% weight)
  const stDate = new Date(stPayment.payment_date);
  const qbDate = new Date(qbPayment.payment_date);
  const daysDiff = Math.abs((stDate.getTime() - qbDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    confidence += 0.2;
  } else if (daysDiff <= 1) {
    confidence += 0.15;
  } else if (daysDiff <= 3) {
    confidence += 0.1;
  } else if (daysDiff <= 7) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Calculate match confidence between a QB payment and AR invoice
 */
function calculateMatchConfidence(
  qbPayment: { amount: number; qb_customer_name: string | null; payment_date: string },
  invoice: { amount_paid: number; invoice_total: number; customer_name: string; last_payment_date: string | null; updated_at: string }
): number {
  let confidence = 0;

  // Amount match (40% weight)
  const exactAmountMatch = Math.abs(invoice.amount_paid - qbPayment.amount) < 0.01 ||
    Math.abs(invoice.invoice_total - qbPayment.amount) < 0.01;
  if (exactAmountMatch) {
    confidence += 0.4;
  }

  // Customer name match (40% weight)
  if (qbPayment.qb_customer_name && invoice.customer_name) {
    const qbName = qbPayment.qb_customer_name.toLowerCase().trim();
    const invName = invoice.customer_name.toLowerCase().trim();

    if (qbName === invName) {
      confidence += 0.4;
    } else if (qbName.includes(invName) || invName.includes(qbName)) {
      confidence += 0.3;
    } else {
      // Partial name match
      const qbParts = qbName.split(/\s+/);
      const invParts = invName.split(/\s+/);
      let partialMatches = 0;

      for (const qbPart of qbParts) {
        for (const invPart of invParts) {
          if (qbPart.length > 2 && invPart.length > 2 &&
            (qbPart === invPart || qbPart.includes(invPart) || invPart.includes(qbPart))) {
            partialMatches++;
          }
        }
      }

      if (partialMatches > 0) {
        confidence += Math.min(0.2 * partialMatches, 0.3);
      }
    }
  }

  // Date proximity (20% weight)
  const qbDate = new Date(qbPayment.payment_date);
  const invDate = new Date(invoice.last_payment_date || invoice.updated_at);
  const daysDiff = Math.abs((qbDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 1) {
    confidence += 0.2;
  } else if (daysDiff <= 3) {
    confidence += 0.15;
  } else if (daysDiff <= 7) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Manually match a payment to an invoice
 */
export async function manualMatch(
  reconciliationId: string,
  arInvoiceId: string,
  matchedBy: string
): Promise<boolean> {
  const supabase = getServerSupabase();

  // Get the invoice details
  const { data: invoice } = await supabase
    .from('ar_invoices')
    .select('*')
    .eq('id', arInvoiceId)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const { error } = await supabase
    .from('ar_payment_reconciliation')
    .update({
      ar_invoice_id: arInvoiceId,
      st_invoice_id: invoice.st_invoice_id,
      st_customer_id: invoice.st_customer_id,
      customer_name: invoice.customer_name,
      match_status: 'manual_matched',
      match_confidence: 1.0,
      matched_at: new Date().toISOString(),
      matched_by: matchedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId);

  if (error) {
    console.error('[QB Sync] Manual match failed:', error);
    throw error;
  }

  return true;
}

/**
 * Mark a reconciliation as a discrepancy
 */
export async function markAsDiscrepancy(
  reconciliationId: string,
  reason?: string
): Promise<boolean> {
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('ar_payment_reconciliation')
    .update({
      match_status: 'discrepancy',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId);

  if (error) {
    console.error('[QB Sync] Mark discrepancy failed:', error);
    throw error;
  }

  return true;
}
