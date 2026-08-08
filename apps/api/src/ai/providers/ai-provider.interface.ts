export interface AiProviderRequest {
  /** System prompt that instructs the model to answer only from provided data. */
  system: string;
  /** User message containing the grounded context and the question. */
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiProviderResult {
  text: string;
  model: string;
  finishReason: string;
}

export class AiProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderUnavailableError';
  }
}

export abstract class AiProvider {
  abstract readonly name: string;

  /** True when required credentials/configuration are present in the env. */
  abstract isConfigured(): boolean;

  abstract generate(request: AiProviderRequest): Promise<AiProviderResult>;
}