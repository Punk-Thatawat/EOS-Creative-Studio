import { getApiAccessToken } from '@/lib/auth/access-token';

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, '')}/api/v1`;

export type DocumentSummary = {
  title: string;
  executiveSummary: string;
  sections?: Array<{ heading: string; items: string[] }>;
  keyTakeaways: string[];
  actionItems: Array<{ task: string; owner?: string; dueDate?: string }>;
  decisions: string[];
  importantDates: Array<{ date: string; event: string }>;
};

export type DocumentSummaryOptions = { model: string; credits: number };

export async function getDocumentSummaryOptions(): Promise<DocumentSummaryOptions> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to summarize a document');
  const response = await fetch(`${backendApiUrl}/documents/summary-options`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: DocumentSummaryOptions; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not load document summary settings'));
  return payload.data;
}

export async function summarizeDocument(input: {
  file: File;
  prompt: string;
  summaryStyle: 'executive' | 'bullets';
  summaryLength: 'brief' | 'standard' | 'detailed';
  language: 'auto' | 'English' | 'Thai';
  includeKeyTakeaways: boolean;
  includeActionItems: boolean;
  includeImportantDates: boolean;
}): Promise<{ id: string; model: string; summary: DocumentSummary; creditsUsed: number }> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to summarize a document');
  const form = new FormData();
  form.append('file', input.file);
  form.append('prompt', input.prompt);
  form.append('summaryStyle', input.summaryStyle);
  form.append('summaryLength', input.summaryLength);
  form.append('language', input.language);
  form.append('includeKeyTakeaways', String(input.includeKeyTakeaways));
  form.append('includeActionItems', String(input.includeActionItems));
  form.append('includeImportantDates', String(input.includeImportantDates));

  const response = await fetch(`${backendApiUrl}/documents/summarize`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: { id: string; model: string; summary: DocumentSummary; creditsUsed: number }; message?: string | string[] } | null;
  if (!response.ok || !payload?.data?.summary) throw new Error(errorMessage(payload?.message, 'Document summary failed'));
  return payload.data;
}

function errorMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}
