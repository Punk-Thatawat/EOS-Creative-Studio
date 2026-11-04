/** Generated image and video media is kept for seven days unless an explicit expiry is provided. */
export const GENERATED_MEDIA_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function isGenerationMediaAvailable(
  createdAt?: string | null,
  expiresAt?: string | null,
  now = Date.now(),
): boolean {
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  if (Number.isFinite(expiry)) return expiry > now;

  const created = createdAt ? Date.parse(createdAt) : NaN;
  // A missing timestamp is not proof of expiry; retain it rather than hiding valid media.
  return !Number.isFinite(created) || created + GENERATED_MEDIA_RETENTION_MS > now;
}
