import { getEnvironmentVariable } from '@langchain/core/utils/env';
import {
  ChatOpenAICompletions,
  type BaseChatOpenAIFields,
} from '@langchain/openai';

/** Default OpenAI-compatible endpoint of the c0mpute network. */
export const C0MPUTE_BASE_URL = 'https://c0mpute.com/v1';

/**
 * Model ids on c0mpute. `auto` and `auto:<effort>` ask the c0mpute router to
 * pick an open model per request; concrete ids depend on the nodes online
 * (GET https://c0mpute.com/v1/models), so any string is accepted.
 */
export type C0mputeModelId =
  | 'auto'
  | 'auto:fast'
  | 'auto:standard'
  | 'auto:high'
  | 'auto:max'
  | 'qwen3:4b'
  | 'qwen2.5-coder:7b'
  | 'qwen3-coder:30b'
  | 'qwen3.8:27b'
  | 'devstral:24b'
  | (string & {});

export interface ChatC0mputeInput
  extends Omit<BaseChatOpenAIFields, 'model' | 'apiKey'> {
  /** Model id. Defaults to `auto`. */
  model?: C0mputeModelId;
  /** c0mpute API key (`c0k_...`). Defaults to the `C0MPUTE_API_KEY` environment variable. */
  apiKey?: string;
  /** Base URL. Defaults to `https://c0mpute.com/v1`. */
  baseURL?: string;
}

/**
 * Shape a Chat Completions body for c0mpute: string message content only
 * (text parts are joined, other parts dropped), no tool fields, and
 * `max_tokens` instead of `max_completion_tokens`.
 */
export function toC0mputeBody(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...body };
  delete out.tools;
  delete out.tool_choice;
  delete out.parallel_tool_calls;
  delete out.stream_options;
  if (out.max_completion_tokens !== undefined && out.max_tokens === undefined) {
    out.max_tokens = out.max_completion_tokens;
  }
  delete out.max_completion_tokens;
  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map((m: Record<string, any>) =>
      Array.isArray(m.content)
        ? {
            ...m,
            content: m.content
              .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
              .map((p: any) => p.text)
              .join('\n'),
          }
        : m,
    );
  }
  return out;
}

function c0mputeFetch(base: typeof fetch = fetch): typeof fetch {
  return (async (input: any, init?: any) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        init = { ...init, body: JSON.stringify(toC0mputeBody(JSON.parse(init.body))) };
      } catch {
        // not JSON, send as is
      }
    }
    return base(input, init);
  }) as typeof fetch;
}

/**
 * LangChain chat model for c0mpute, a peer-to-peer compute network serving
 * open-weight models with sealed-bid auction pricing.
 *
 * ```ts
 * import { ChatC0mpute } from '@profullstack/langchain-c0mpute';
 * const llm = new ChatC0mpute({ model: 'auto' });
 * const res = await llm.invoke('Hello');
 * ```
 */
export class ChatC0mpute extends ChatOpenAICompletions {
  static lc_name() {
    return 'ChatC0mpute';
  }

  _llmType() {
    return 'c0mpute';
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return { apiKey: 'C0MPUTE_API_KEY' };
  }

  constructor(fields: ChatC0mputeInput = {}) {
    const apiKey = fields.apiKey ?? getEnvironmentVariable('C0MPUTE_API_KEY');
    if (!apiKey) {
      throw new Error(
        'c0mpute API key not found. Pass `apiKey` or set C0MPUTE_API_KEY (get a c0k_ key from the keys tab of https://c0mpute.com/chat).',
      );
    }
    const { baseURL, configuration, ...rest } = fields;
    super({
      ...rest,
      model: fields.model ?? 'auto',
      apiKey,
      streamUsage: false,
      configuration: {
        ...configuration,
        baseURL: baseURL ?? configuration?.baseURL ?? C0MPUTE_BASE_URL,
        fetch: c0mputeFetch(configuration?.fetch as typeof fetch | undefined),
      },
    });
  }

  /** c0mpute does not support tool calling yet. */
  override bindTools(): never {
    throw new Error(
      'c0mpute does not support tool calling yet. Use the model for plain chat, or attach tools as c0mpute chat plugins on https://c0mpute.com.',
    );
  }
}
