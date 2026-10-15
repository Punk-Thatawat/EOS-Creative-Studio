import { getApiAccessToken } from '@/lib/auth/access-token';

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, '')}/api/v1`;

export type ContractTypeId = 'auto' | 'rental' | 'employment' | 'service' | 'loan' | 'sale' | 'nda' | 'other';
export type ContractSeverity = 'high' | 'medium' | 'low';

export type ContractFact = { label: string; value: string };
export type ContractRisk = {
  severity: ContractSeverity;
  title: string;
  /** The wording in the contract this is about, as written. */
  clause?: string;
  explanation: string;
  suggestion?: string;
};
export type ContractReview = {
  title: string;
  contractType: string;
  summary: string;
  keyFacts: ContractFact[];
  risks: ContractRisk[];
};
export type ContractReviewResult = { id: string; model: string; creditsUsed: number; review: ContractReview; /** Id of the history entry this review was saved as. */ historyId?: string };
export type ContractOptions = { model: string; credits: number; maxMegabytes: number };

function errorMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : fallback;
}

export async function getContractOptions(): Promise<ContractOptions> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to review a contract');
  const response = await fetch(`${backendApiUrl}/documents/contract/options`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: ContractOptions; message?: string | string[] } | null;
  if (!response.ok || !payload?.data) throw new Error(errorMessage(payload?.message, 'Could not load contract review settings'));
  return payload.data;
}

export async function reviewContract(input: {
  file: File;
  contractType: ContractTypeId;
  party?: string;
  language: 'auto' | 'English' | 'Thai';
  model?: string;
}): Promise<ContractReviewResult> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to review a contract');
  const form = new FormData();
  form.append('file', input.file);
  form.append('contractType', input.contractType);
  if (input.party?.trim()) form.append('party', input.party.trim());
  form.append('language', input.language);
  if (input.model) form.append('model', input.model);

  const response = await fetch(`${backendApiUrl}/documents/contract/review`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { data?: ContractReviewResult; message?: string | string[] } | null;
  if (!response.ok || !payload?.data?.review) throw new Error(errorMessage(payload?.message, 'Contract review failed'));
  return payload.data;
}

export type ContractHistoryItem = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  title: string;
  /** What the user said it was (`auto`, `rental`, ...). */
  contractType: ContractTypeId;
  party?: string;
  riskCount: number;
  highRiskCount: number;
  creditsUsed: number;
  createdAt: string;
  expiresAt: string;
};

export type ContractHistoryPage = { items: ContractHistoryItem[]; total: number; retentionDays: number };

async function historyRequest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to see your history');
  const response = await fetch(`${backendApiUrl}/documents/contract/history${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    cache: 'no-store',
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null) as { data?: T; message?: string | string[] } | null;
  if (!response.ok || payload?.data === undefined) throw new Error(errorMessage(payload?.message, 'Could not load your history'));
  return payload.data;
}

export async function listContractHistory(input: { limit: number; offset: number }): Promise<ContractHistoryPage> {
  const page = await historyRequest<ContractHistoryPage>(`?limit=${input.limit}&offset=${input.offset}`);
  if (!page) throw new Error('Could not load your history');
  return page;
}

/** The full stored review of one history entry. */
export async function getContractHistory(id: string): Promise<{ item: ContractHistoryItem; result: ContractReviewResult }> {
  const found = await historyRequest<{ item: ContractHistoryItem; result: ContractReviewResult }>(`/${encodeURIComponent(id)}`);
  if (!found) throw new Error('This history item could not be opened');
  return found;
}

export async function deleteContractHistoryItem(id: string): Promise<void> {
  await historyRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearContractHistory(): Promise<void> {
  await historyRequest('', { method: 'DELETE' });
}
