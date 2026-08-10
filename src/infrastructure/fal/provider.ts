export type GenerationKind = "image" | "video" | "ai-presenter" | "audio" | "document" | "workflow";

export interface ProviderGenerationRequest {
  readonly kind: GenerationKind;
  readonly model: string;
  readonly input: Record<string, string | number | boolean>;
}

export interface ProviderGenerationAccepted {
  readonly providerRequestId: string;
  readonly acceptedAt: string;
}

export interface GenerationProvider {
  enqueue(request: ProviderGenerationRequest): Promise<ProviderGenerationAccepted>;
}

/** fal.ai will implement this port in the provider integration phase. */
export function createGenerationProvider(): GenerationProvider {
  return {
    async enqueue(): Promise<ProviderGenerationAccepted> {
      throw new Error("Generation provider is not configured yet.");
    },
  };
}
