const STORAGE_KEY = "eos.affiliate.ref";
/** A link clicked today still counts if the visitor signs up within this many days. */
const KEEP_DAYS = 30;
const CODE_PATTERN = /^[A-Za-z0-9]{4,32}$/;

type Stored = { code: string; savedAt: number };

/** The affiliate code in a link's `?ref=` value, or null when it is missing or not shaped like a code. */
export function parseReferralCode(value: string | null | undefined): string | null {
  const code = value?.trim() ?? "";
  return CODE_PATTERN.test(code) ? code.toUpperCase() : null;
}

/** Remembers a code from the address bar. A newer link replaces an older one. Storage may be blocked; that is fine. */
export function rememberReferralCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() } satisfies Stored));
  } catch {
    // Private windows and blocked storage simply skip the referral.
  }
}

/** The remembered code while it is still fresh, otherwise null (an old one is dropped). */
export function readReferralCode(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored>;
    const fresh = typeof stored.savedAt === "number" && Date.now() - stored.savedAt < KEEP_DAYS * 24 * 60 * 60 * 1000;
    const code = fresh ? parseReferralCode(stored.code) : null;
    if (!code) window.localStorage.removeItem(STORAGE_KEY);
    return code;
  } catch {
    return null;
  }
}

export function forgetReferralCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/** The link a member shares: the landing page with their code. */
export function buildReferralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/?ref=${encodeURIComponent(code)}`;
}
