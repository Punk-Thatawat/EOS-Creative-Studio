export type GenerationErrorSource = "system" | "provider";

export type GenerationErrorPayload = {
  errorSource?: unknown;
  source?: unknown;
  errorCode?: unknown;
  code?: unknown;
  errorMessage?: unknown;
  message?: unknown;
};

export class GenerationApiError extends Error {
  readonly source: GenerationErrorSource;
  readonly code?: string;

  constructor(message: string, source: GenerationErrorSource = "system", code?: string) {
    super(message);
    this.name = "GenerationApiError";
    this.source = source;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export function errorSourceFromCode(code?: string): GenerationErrorSource {
  return code?.startsWith("PROVIDER_") ? "provider" : "system";
}

export function generationErrorFromPayload(payload: unknown, fallbackMessage: string): GenerationApiError {
  const record = isRecord(payload) ? payload as GenerationErrorPayload : {};
  const code = stringValue(record.errorCode) ?? stringValue(record.code);
  const declaredSource = record.errorSource === "provider" || record.source === "provider"
    ? "provider"
    : record.errorSource === "system" || record.source === "system"
      ? "system"
      : undefined;
  const source = declaredSource ?? errorSourceFromCode(code);
  const rawMessage = record.errorMessage ?? record.message;
  const message = typeof rawMessage === "string"
    ? rawMessage
    : Array.isArray(rawMessage) && rawMessage.every((item) => typeof item === "string")
      ? rawMessage.join(", ")
      : fallbackMessage;
  return new GenerationApiError(message, source, code);
}

export function generationErrorFromStatus(
  status: { errorSource?: unknown; errorCode?: unknown; errorMessage?: unknown; status?: string },
  fallbackMessage: string,
): GenerationApiError {
  return generationErrorFromPayload(status, fallbackMessage);
}

export function formatGenerationError(error: unknown, fallbackMessage: string): string {
  const source: GenerationErrorSource = error instanceof GenerationApiError
    ? error.source
    : errorSourceFromCode(error instanceof Error ? error.message : undefined);
  const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
  return `${source === "provider" ? "Provider error" : "System error"}: ${message}`;
}
