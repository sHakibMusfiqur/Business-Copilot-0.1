import { Injectable, Logger } from '@nestjs/common';

import { AiConfigService } from './ai-config.service';
import type { AiAskResponse, AiIntentKind, AiQueryData, AiUnavailable } from './ai.types';
import { CopilotDataService, HasPermission } from './data/copilot-data.service';
import { AiProvider, AiProviderUnavailableError } from './providers/ai-provider.interface';

interface IntentRule {
  intent: AiIntentKind;
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'sales_summary',
    patterns: [/sales\b/i, /orders?\b/i, /sold\b/i, /booked/i],
  },
  {
    intent: 'revenue',
    patterns: [/revenue/i, /income/i, /earned/i, /how much.*made/i],
  },
  {
    intent: 'expenses',
    patterns: [/expense/i, /spend/i, /spent/i, /costs? (inc|went|up)/i],
  },
  {
    intent: 'receivables',
    patterns: [/receivable/i, /outstanding/i, /owed (to us|by)/i, /customers owe/i, /unpaid invoice/i],
  },
  {
    intent: 'payables',
    patterns: [/payable/i, /we owe/i, /owe suppliers/i, /pay (my )?suppliers/i],
  },
  {
    intent: 'inventory',
    patterns: [/inventory/i, /stock\b/i, /low stock/i, /reorder/i, /products (in )?(stock|warehouse)/i],
  },
  {
    intent: 'customers',
    patterns: [/customer/i, /clients?\b/i],
  },
  {
    intent: 'suppliers',
    patterns: [/supplier/i, /vendor/i],
  },
  {
    intent: 'trends',
    patterns: [/trend/i, /month over month/i, /m\/m/i, /over the (past|last|previous)/i, /growth/i],
  },
  {
    intent: 'performance',
    patterns: [/performance/i, /overview/i, /summary/i, /how (?:is|are).*(doing|performing)/i, /health of/i],
  },
];

/**
 * Orchestrates the Copilot request lifecycle:
 *   1. Classify the user's question into a grounded business-data query.
 *   2. Retrieve authorized, organization-scoped data.
 *   3. If an LLM provider is configured and healthy, instruct it to answer
 *      strictly from the provided data; otherwise surface an explicit
 *      unavailable state (never a fabricated response).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly dataService: CopilotDataService,
    private readonly provider: AiProvider,
    private readonly config: AiConfigService,
  ) {}

  classify(query: string): AiIntentKind {
    for (const rule of INTENT_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(query))) {
        return rule.intent;
      }
    }
    return 'general';
  }

  async ask(
    query: string,
    orgId: string,
    permissions: string[],
    maxTokens?: number,
  ): Promise<AiAskResponse> {
    const has: HasPermission = (permission) => permissions.includes(permission);

    const intent = this.classify(query);
    const provider = this.config.status();

    let data: AiQueryData | undefined;
    let unavailable: AiUnavailable | undefined;
    let answer: AiAskResponse['answer'] | undefined;

    if (intent !== 'general') {
      data = await this.dataService.retrieve(intent, orgId, has);
    }

    if (!provider.configured) {
      unavailable = {
        code: 'provider_not_configured' as const,
        message:
          'The Copilot assistant is not configured. An organization owner must add an AI provider key (OPENAI_API_KEY) to enable natural-language answers. Your live business data is shown below.',
      };
    } else {
      try {
        const result = await this.provider.generate({
          system:
            'You are Business Copilot, an assistant inside an ERP. Answer the user\'s business question using ONLY the provided, real, organization-scoped data. ' +
            'Never invent numbers, customers, or trends. If the data is insufficient, say so plainly and suggest what the user can check. ' +
            'Be concise and directly answer the question. Use plain text with minimal formatting.',
          user: this.buildUserPrompt(query, data),
          maxTokens: maxTokens ?? 600,
        });
        answer = { text: result.text, model: result.model };
      } catch (error) {
        if (error instanceof AiProviderUnavailableError) {
          this.logger.warn(`Copilot provider unavailable: ${error.message}`);
          unavailable = {
            code: 'provider_error' as const,
            message:
              'The AI provider could not complete the request. Your live business data is shown below — please try again shortly.',
          };
        } else {
          throw error;
        }
      }
    }

    return {
      intent,
      provider,
      data,
      answer,
      unavailable,
    };
  }

  private buildUserPrompt(query: string, data?: AiAskResponse['data']): string {
    const facts = data
      ? JSON.stringify({
          permitted: data.permitted,
          title: data.title,
          value: data.value,
          currency: data.currency,
          points: data.points,
          tables: data.tables,
          summaryLines: data.summaryLines,
        })
      : 'No specific data requested yet.';
    return `Business question: ${query}\n\nRelevant organization data:\n${facts}`;
  }
}