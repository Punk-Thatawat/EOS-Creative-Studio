import { getApiAccessToken } from '@/lib/auth/access-token';

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, '')}/api/v1`;

export type TranslationLanguage = 'auto' | 'Thai' | 'English' | 'Japanese' | 'Chinese';
export type TranslationOutputFormat = 'PDF' | 'DOCX' | 'TXT' | 'JSON';
export type DocumentTranslation = {
  id: string;
  model: string;
  translatedText: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
  creditsUsed: number;
  outputFile?: {
    filename: string;
    mimeType: string;
    data: string;
  };
};

export async function translateDocument(input: {
  file: File;
  model?: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: Exclude<TranslationLanguage, 'auto'>;
}): Promise<DocumentTranslation> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to translate a document');
  const form = new FormData();
  form.append('file', input.file);
  if (input.model) form.append('model', input.model);
  form.append('sourceLanguage', input.sourceLanguage);
  form.append('targetLanguage', input.targetLanguage);
  const response = await fetch(`${backendApiUrl}/documents/translate`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: DocumentTranslation; message?: string | string[] } | null;
  if (!response.ok || !payload?.data?.translatedText) {
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new Error(typeof message === 'string' ? message : 'Document translation failed');
  }
  return payload.data;
}
