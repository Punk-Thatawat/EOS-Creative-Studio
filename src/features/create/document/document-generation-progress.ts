import {
  emitGenerationRequestFailed,
  emitGenerationRequestFinished,
  emitGenerationSubmitting,
} from "@/lib/generation-progress-events";

export type DocumentGenerationFeature =
  | "document-ocr"
  | "document-summary"
  | "document-translate"
  | "document-contract"
  | "document-report"
  | "document-form";

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function startDocumentGeneration(feature: DocumentGenerationFeature): string {
  const requestId = createRequestId();
  emitGenerationSubmitting({ feature, requestId });
  return requestId;
}

export function finishDocumentGeneration(feature: DocumentGenerationFeature, requestId: string): void {
  emitGenerationRequestFinished({ feature, requestId });
}

export function failDocumentGeneration(feature: DocumentGenerationFeature, requestId: string): void {
  emitGenerationRequestFailed({ feature, requestId });
}
