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
export type ContractReviewResult = { id: string; model: string; creditsUsed: number; review: ContractReview };
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
}): Promise<ContractReviewResult> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) throw new Error('Please sign in to review a contract');
  const form = new FormData();
  form.append('file', input.file);
  form.append('contractType', input.contractType);
  if (input.party?.trim()) form.append('party', input.party.trim());
  form.append('language', input.language);

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
