import { getApiAccessToken } from '@/lib/auth/access-token';

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, '')}/api/v1`;

/** A rectangle on one page, as fractions (0-1) of that page's width and height. */
export type FormBox = { page: number; left: number; top: number; right: number; bottom: number };
export type FormFieldType = 'text' | 'checkbox' | 'signature';

export type FormField = {
  id: string;
  /** The name printed on the form. */
  label: string;
  /** What was filled in; empty when the field was left blank. */
  value: string;
  type: FormFieldType;
  /** 0-1: how sure the AI is it read this right. */
  confidence: number;
  /** The value as it was read, kept once the person corrects it: a field whose value differs was edited. */
  original?: string;
  /** Where the value sits on the pages; empty when it could not be placed. */
  boxes: FormBox[];
};

/** A block of text the OCR found, kept while the document is on screen so a drawn box can become a value. */
export type FormBlock = FormBox & { id: string; text: string };
export type FormPage = { page: number; width: number; height: number };

export type FormReadResult = {
  id: string;
  model: string;
  creditsUsed: number;
  pages: FormPage[];
  fields: FormField[];
  blocks?: FormBlock[];
  /** Id of the history entry this reading was saved as. */
  historyId?: string;
};

export type FormOptions = { model: string; creditsPerPage: number; maxPages: number; maxMegabytes: number };

function errorMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export async function getFormOptions(): Promise<FormOptions> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to read a form');
  const response = await fetch(`${backendApiUrl}/documents/form/options`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: FormOptions; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not load form reading settings'));
  return payload.data;
}

/** `fields` is the text the user typed (names separated by commas or new lines); empty lets the AI find every field. */
export async function readForm(input: { file: File; fields?: string; model?: string }): Promise<FormReadResult> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to read a form');
  const form = new FormData();
  form.append('file', input.file);
  if (input.fields?.trim()) form.append('fields', input.fields.trim());
  if (input.model) form.append('model', input.model);

  const response = await fetch(`${backendApiUrl}/documents/form/read`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: FormReadResult; message?: string | string[] } | null;
  if (!response.ok || !payload?.data?.fields) throw new Error(errorMessage(payload?.message, 'Reading the form failed'));
  return payload.data;
}

export type FormHistoryItem = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  pages: number;
  fieldCount: number;
  /** Fields the AI was not sure about. */
  lowConfidenceCount: number;
  creditsUsed: number;
  createdAt: string;
  expiresAt: string;
  /** Saved with its pages and marks, so it opens as the edited document. */
  hasDocument: boolean;
  savedAt: string | null;
};

export type FormHistoryPage = { items: FormHistoryItem[]; total: number; retentionDays: number };

async function historyRequest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to see your history');
  const response = await fetch(`${backendApiUrl}/documents/form/history${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    cache: 'no-store',
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null) as { data?: T; message?: string | string[] } | null;
  if (!response.ok || payload?.data === undefined) throw new Error(errorMessage(payload?.message, 'Could not load your history'));
  return payload.data;
}

export async function listFormHistory(input: { limit: number; offset: number }): Promise<FormHistoryPage> {
  const page = await historyRequest<FormHistoryPage>(`?limit=${input.limit}&offset=${input.offset}`);
  if (!page) throw new Error('Could not load your history');
  return page;
}

/** The full stored reading of one history entry (fields only: the form and the OCR blocks are not kept). */
export async function getFormHistory(id: string): Promise<{ item: FormHistoryItem; result: FormReadResult }> {
  const found = await historyRequest<{ item: FormHistoryItem; result: FormReadResult }>(`/${encodeURIComponent(id)}`);
  if (!found) throw new Error('This history item could not be opened');
  return found;
}

export async function deleteFormHistoryItem(id: string): Promise<void> {
  await historyRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearFormHistory(): Promise<void> {
  await historyRequest('', { method: 'DELETE' });
}

/** What "save changes" stores. `marks` are the front end's page marks; `pages` (JPEGs, every page in order) are sent the first time only. */
export async function saveFormEdits(id: string, input: { fields: FormField[]; rotation: number; marks: unknown[]; pages?: Blob[] }): Promise<{ savedAt: string; hasDocument: boolean }> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to save your changes');
  const form = new FormData();
  form.append('payload', JSON.stringify({ fields: input.fields, rotation: input.rotation, marks: input.marks }));
  input.pages?.forEach((page, index) => form.append('pages', page, `page-${index + 1}.jpg`));
  const response = await fetch(`${backendApiUrl}/documents/form/history/${encodeURIComponent(id)}/edits`, {
    method: 'PUT',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: { savedAt: string; hasDocument: boolean }; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not save your changes'));
  return payload.data;
}

export type FormSavedDocument = {
  pages: Array<{ page: number; mimeType: string; base64: string }>;
  edits: { rotation: number; marks: unknown[] };
};

/** The pages and marks saved with a reading. */
export async function getFormDocument(id: string): Promise<FormSavedDocument> {
  const saved = await historyRequest<FormSavedDocument>(`/${encodeURIComponent(id)}/document`);
  if (!saved) throw new Error('This history item has no saved document');
  return saved;
}
