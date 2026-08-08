import { Injectable } from '@nestjs/common';

import type { AiProviderStatus } from './ai.types';

export interface OpenAiProviderConfig {
  provider: 'openai';
  apiKey: string;
  model: string;
  baseUrl: string;
}


@Injectable()
export class AiConfigService {
  getProviderName(): string {
    return process.env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  }

  getOpenAiConfig(): OpenAiProviderConfig | null {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    return {
      provider: 'openai',
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    };
  }

  status(): AiProviderStatus {
    const openAi = this.getOpenAiConfig();
    return {
      configured: openAi !== null,
      provider: this.getProviderName(),
      model: openAi?.model ?? null,
    };
  }
}