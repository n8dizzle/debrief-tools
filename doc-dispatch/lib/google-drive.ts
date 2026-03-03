import { GoogleAuth } from 'google-auth-library';
import { getServerSupabase } from './supabase';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getAuth() {
  const keyJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not configured');
  }

  // Support both raw JSON and base64-encoded JSON (base64 avoids newline issues in Vercel)
  let jsonStr: string;
  if (keyJson.trim().startsWith('{')) {
    jsonStr = keyJson;
  } else {
    jsonStr = Buffer.from(keyJson, 'base64').toString('utf-8');
  }
  const key = JSON.parse(jsonStr);

  return new GoogleAuth({
    credentials: key,
    scopes: SCOPES,
  });
}

async function getAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

/**
 * Find or create a subfolder by name under the root Doc Dispatch folder.
 */
async function getOrCreateFolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  // Search for existing folder
  const q = encodeURIComponent(
    `'${parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();

  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  // Create the folder
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    }
  );
  const createData = await createRes.json();

  if (!createRes.ok) {
    throw new Error(`Failed to create folder: ${JSON.stringify(createData)}`);
  }

  return createData.id;
}

/** Map document_type to a human-readable folder name */
function getFolderName(documentType: string | null): string {
  const map: Record<string, string> = {
    invoice: 'Invoices',
    permit: 'Permits',
    contract: 'Contracts',
    lien_waiver: 'Lien Waivers',
    warranty: 'Warranties',
    estimate: 'Estimates',
    purchase_order: 'Purchase Orders',
    work_order: 'Work Orders',
    insurance: 'Insurance',
    inspection: 'Inspections',
    letter: 'Letters',
    receipt: 'Receipts',
    other: 'Other',
  };
  return map[documentType || 'other'] || 'Other';
}

function getContentType(imagePath: string): string {
  const ext = imagePath.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

interface UploadParams {
  documentId: string;
  imageBuffer: ArrayBuffer;
  imagePath: string;
  documentType: string | null;
  title: string | null;
}

/**
 * Upload a document image to Google Drive using the multipart upload REST API.
 * Updates the dd_documents record with the Drive file ID.
 * Throws on error so callers can surface the message.
 */
export async function uploadToGoogleDrive({
  documentId,
  imageBuffer,
  imagePath,
  documentType,
  title,
}: UploadParams): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');
  }

  const accessToken = await getAccessToken();

  const folderName = getFolderName(documentType);
  const folderId = await getOrCreateFolder(accessToken, rootFolderId, folderName);

  // Build filename: "YYYY-MM-DD - Title.ext"
  const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const safeName = title
    ? title.replace(/[\/\\:*?"<>|]/g, '-').substring(0, 100)
    : 'Document';
  const fileName = `${dateStr} - ${safeName}.${ext}`;
  const mimeType = getContentType(imagePath);

  // Build multipart/related request body
  const boundary = 'doc_dispatch_boundary';
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
  const mediaPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const base64Data = Buffer.from(imageBuffer).toString('base64');
  const body = metadataPart + mediaPart + base64Data + closing;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`);
  }

  const driveFileId = uploadData.id;

  // Store the Drive file ID on the document record
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('dd_documents')
    .update({ drive_file_id: driveFileId })
    .eq('id', documentId);

  if (error) {
    console.error(`Failed to save drive_file_id for doc ${documentId}:`, error);
  }

  console.log(`Uploaded doc ${documentId} to Google Drive: ${driveFileId} (${folderName}/${fileName})`);
  return driveFileId;
}
