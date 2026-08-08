import { Injectable, Logger } from '@nestjs/common';

import { AiConfigService } from '../ai-config.service';

import {
  AiProvider,
  AiProviderRequest,
  AiProviderResult,
  AiProviderUnavailableError,
} from './ai-provider.interface';

const REQUEST_TIMEOUT_MS = 30_000;

interface OpenAiErrorBody {
  error?: { message?: string; type?: string };
}

interface OpenAiMessage {
  role: string;
  content: string;
}

interface OpenAiChoice {
  message?: OpenAiMessage;
  finish_reason?: string;
}

interface OpenAiChatBody {
  model?: string;
  choices?: OpenAiChoice[];
}

/**
 * OpenAI-compatible provider. Uses the native `fetch`, never fabricates a
 * success, and throws `AiProviderUnavailableError` for every failure mode
 * (missing key, network error, timeout, rate limit or malformed response).
 */
@Injectable()
export class OpenAiProvider extends AiProvider {
  readonly name = 'openai';

  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly config: AiConfigService) {
    super();
  }

  isConfigured(): boolean {
    return this.config.getOpenAiConfig() !== null;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const config = this.config.getOpenAiConfig();
    if (!config) {
      throw new AiProviderUnavailableError(
        'The AI provider is not configured. Set OPENAI_API_KEY (and optionally OPENAI_MODEL / OPENAI_BASE_URL) to enable the Copilot assistant.',
      );
    }

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          max_tokens: request.maxTokens ?? 800,
          temperature: request.temperature ?? 0.2,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const body = (await response.json().catch(() => ({}))) as
        | OpenAiChatBody
        | OpenAiErrorBody;

      if (!response.ok) {
        const message =
          (body as OpenAiErrorBody).error?.message ??
          `OpenAI returned HTTP ${response.status}`;
        this.logger.warn(`Copilot provider error: ${message}`);
        throw new AiProviderUnavailableError(
          `The AI provider could not complete the request (HTTP ${response.status}). ${message}`,
        );
      }

      const chat = body as OpenAiChatBody;
      const choice = chat.choices?.[0];
      const content = choice?.message?.content?.trim();
      if (!content) {
        throw new AiProviderUnavailableError(
          'The AI provider returned no content.',
        );
      }

      return {
        text: content,
        model: chat.model ?? config.model,
        finishReason: choice?.finish_reason ?? 'stop',
      };
    } catch (error) {
      if (error instanceof AiProviderUnavailableError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        this.logger.warn('Copilot provider request timed out');
        throw new AiProviderUnavailableError(
          'The AI provider request timed out. Please try again shortly.',
        );
      }
      const cause = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Copilot provider request failed: ${cause}`);
      throw new AiProviderUnavailableError(
        `The AI provider request failed: ${cause}`,
      );
    }
  }
}