import { getApiAccessToken } from '@/lib/auth/access-token';

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, '')}/api/v1`;

export type OcrDocumentTypeId =
  | 'general'
  | 'receipt'
  | 'bank-statement'
  | 'credit-card-statement'
  | 'ncb-credit-report'
  | 'tax-deduction-certificate'
  | 'electricity-bill'
  | 'water-bill'
  | 'vehicle-registration'
  | 'company-certificate'
  | 'civil-registration'
  | 'curriculum-vitae'
  | 'job-description';

export type OcrOutputFormat = 'txt' | 'json' | 'docx' | 'pdf';
export type OcrDepth = 'basic' | 'advanced';
export type OcrStyle = 'professional' | 'friendly' | 'concise' | 'formal';
export type OcrStyleChoice = 'original' | OcrStyle;

export type OcrLayoutComponent = {
  /** iApp's block type, e.g. `Title`, `TextBox`. */
  type: string;
  text: string;
  box: { left: number; top: number; right: number; bottom: number };
};

export type OcrLayoutPage = { page: number; components: OcrLayoutComponent[] };

export type OcrDocumentTypeInfo = {
  id: OcrDocumentTypeId;
  creditsPerPage: number;
  /** `docx` / `pdf` are generated files and only exist for general OCR. */
  outputFormats: OcrOutputFormat[];
  creditsPerPageByFormat?: Partial<Record<'docx' | 'pdf', number>>;
  /** General OCR only: `advanced` returns the page layout. */
  depths?: OcrDepth[];
  creditsPerPageAdvanced?: number;
  /** General OCR only: AI tone / style rewrite of the extracted text. */
  styles?: OcrStyleChoice[];
  styleCredits?: number;
  extensions: string[];
  maxMegabytes: number;
  maxPages?: number;
  supports: { targetLang: boolean; includeConfidence: boolean; returnOcr: boolean };
};

export type OcrDocumentResult = {
  fields: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  raw?: unknown;
};

export type DocumentOcrResult = {
  id: string;
  documentType: OcrDocumentTypeId;
  outputFormat: OcrOutputFormat;
  depth: OcrDepth;
  pages: number;
  /** One entry per page for general OCR. */
  text: string[];
  /** One entry per recognised document for structured document types. */
  documents: OcrDocumentResult[];
  layout?: OcrLayoutPage[];
  /** AI-rewritten text, one entry per page. */
  styledText?: string[];
  style?: OcrStyle;
  /** Credits charged for the rewrite, on top of `creditsUsed`. */
  styleCreditsUsed?: number;
  /** A rewrite was requested but failed; nothing was charged for it. */
  styleFailed?: boolean;
  /** The generated DOCX / searchable PDF, when one of those outputs was requested. */
  file?: { filename: string; mimeType: string; base64: string };
  processMs?: number;
  creditsUsed: number;
};

export type DocumentOcrInput = {
  file: File;
  documentType: OcrDocumentTypeId;
  targetLang?: 'th' | 'en';
  includeConfidence?: boolean;
  returnOcr?: boolean;
  outputFormat?: OcrOutputFormat;
  depth?: OcrDepth;
  style?: OcrStyleChoice;
  /** PDF only, e.g. `1-3, 5`. */
  pageRange?: string;
};

export async function listDocumentOcrTypes(): Promise<OcrDocumentTypeInfo[]> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to use document OCR');
  const response = await fetch(`${backendApiUrl}/documents/ocr/types`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: OcrDocumentTypeInfo[]; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not load document types'));
  return payload.data;
}

export async function runDocumentOcr(input: DocumentOcrInput, signal?: AbortSignal): Promise<DocumentOcrResult> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to use document OCR');
  const form = new FormData();
  form.append('file', input.file);
  form.append('documentType', input.documentType);
  if (input.targetLang) form.append('targetLang', input.targetLang);
  if (input.includeConfidence !== undefined) form.append('includeConfidence', String(input.includeConfidence));
  if (input.returnOcr !== undefined) form.append('returnOcr', String(input.returnOcr));
  if (input.outputFormat) form.append('outputFormat', input.outputFormat);
  if (input.depth) form.append('depth', input.depth);
  if (input.style) form.append('style', input.style);
  if (input.pageRange) form.append('pageRange', input.pageRange);

  const response = await fetch(`${backendApiUrl}/documents/ocr`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => null) as { data?: DocumentOcrResult; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Document OCR failed'));
  return payload.data;
}

function errorMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export type OcrExportBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'fields'; rows: Array<{ label: string; value: string }> }
  | { type: 'table'; columns: string[]; rows: string[][] };

/** Renders an already-extracted result as a Word or PDF file on the backend. Free: nothing goes to the OCR provider. */
export async function exportDocumentOcr(input: {
  format: 'docx' | 'pdf';
  filename: string;
  title: string;
  subtitle?: string;
  blocks: OcrExportBlock[];
}): Promise<{ filename: string; mimeType: string; base64: string }> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to export a document');
  const response = await fetch(`${backendApiUrl}/documents/ocr/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: { filename: string; mimeType: string; base64: string }; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not create the file'));
  return payload.data;
}
