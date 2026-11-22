import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';
import { C0MPUTE_BASE_URL, ChatC0mpute, toC0mputeBody } from '../src/index';

type Call = { url: string; headers: Headers; body: any };

function mockFetch(respond: () => Response) {
  const calls: Call[] = [];
  const fetchImpl: typeof globalThis.fetch = (async (input: any, init?: any) => {
    const req = input instanceof Request ? input : undefined;
    calls.push({
      url: String(req ? req.url : input),
      headers: new Headers(init?.headers ?? req?.headers),
      body: init?.body ? JSON.parse(init.body) : undefined,
    });
    return respond();
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

const completion = (content: string) =>
  new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'qwen3:4b',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );

describe('ChatC0mpute', () => {
  it('calls c0mpute with the key and default model auto', async () => {
    const { fetch, calls } = mockFetch(() => completion('pong'));
    const llm = new ChatC0mpute({ apiKey: 'c0k_test', configuration: { fetch } });
    const res = await llm.invoke([new SystemMessage('be brief'), new HumanMessage('ping')]);
    expect(res.content).toBe('pong');
    expect(calls[0].url).toBe(`${C0MPUTE_BASE_URL}/chat/completions`);
    expect(calls[0].headers.get('authorization')).toBe('Bearer c0k_test');
    expect(calls[0].body.model).toBe('auto');
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'ping' },
    ]);
    expect(llm._llmType()).toBe('c0mpute');
  });

  it('flattens multi-part text content to a string', async () => {
    const { fetch, calls } = mockFetch(() => completion('ok'));
    const llm = new ChatC0mpute({ apiKey: 'k', model: 'qwen3:4b', configuration: { fetch } });
    await llm.invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
      }),
    ]);
    expect(calls[0].body.messages[0].content).toBe('a\nb');
    expect(calls[0].body.model).toBe('qwen3:4b');
  });

  it('streams a response that carries SSE status comments', async () => {
    const sse = [
      'data: {"id":"c","object":"chat.completion.chunk","created":1,"model":"qwen3:4b","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      ': status {"state":"running","eta_s":22}',
      'data: {"id":"c","object":"chat.completion.chunk","created":1,"model":"qwen3:4b","choices":[{"index":0,"delta":{"content":"1 2 3"},"finish_reason":null}]}',
      'data: {"id":"c","object":"chat.completion.chunk","created":1,"model":"qwen3:4b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
      '',
    ].join('\n\n');
    const { fetch, calls } = mockFetch(
      () => new Response(sse, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const llm = new ChatC0mpute({ apiKey: 'k', configuration: { fetch } });
    let text = '';
    for await (const chunk of await llm.stream('count')) text += chunk.content;
    expect(text).toBe('1 2 3');
    expect(calls[0].body.stream).toBe(true);
    expect(calls[0].body.stream_options).toBeUndefined();
  });

  it('bindTools sends tools and returns tool_calls', async () => {
    const { fetch, calls } = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            id: 'chatcmpl-1',
            object: 'chat.completion',
            created: 1,
            model: 'qwen3:4b',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } }],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    const llm = new ChatC0mpute({ apiKey: 'k', configuration: { fetch } });
    const res = await llm
      .bindTools([
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Current weather for a city',
            parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
          },
        },
      ])
      .invoke('weather in Paris?');
    expect(calls[0].body.tools[0].function.name).toBe('get_weather');
    expect(res.tool_calls?.[0]).toMatchObject({ name: 'get_weather', args: { city: 'Paris' }, id: 'call_1' });
  });

  it('requires an API key', () => {
    const before = process.env.C0MPUTE_API_KEY;
    delete process.env.C0MPUTE_API_KEY;
    try {
      expect(() => new ChatC0mpute()).toThrow(/C0MPUTE_API_KEY/);
    } finally {
      if (before !== undefined) process.env.C0MPUTE_API_KEY = before;
    }
  });
});

describe('toC0mputeBody', () => {
  it('maps max_completion_tokens and keeps tool fields', () => {
    expect(
      toC0mputeBody({
        model: 'auto',
        messages: [],
        max_completion_tokens: 50,
        tools: [{}],
        tool_choice: 'auto',
      }),
    ).toEqual({ model: 'auto', messages: [], max_tokens: 50, tools: [{}], tool_choice: 'auto' });
  });
});
