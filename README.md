# @profullstack/langchain-c0mpute

[LangChain.js](https://js.langchain.com) chat model for [c0mpute](https://c0mpute.com).

c0mpute is a decentralized, peer-to-peer compute network. Your request runs on someone's spare computer (a "node") that serves open-weight models such as Qwen, Devstral and Nemotron. There is no rate card: every job is a sealed-bid auction among the nodes online, the lowest bid under your cap wins, and the market takes a 5% fee. Speed and quality vary by node and model.

The network is MIT licensed: [github.com/profullstack/c0mpute](https://github.com/profullstack/c0mpute).

## Install

```bash
npm install @profullstack/langchain-c0mpute @langchain/core
```

Get an API key (`c0k_...`) from the keys tab of [c0mpute.com/chat](https://c0mpute.com/chat) (sign in with CoinPay):

```bash
export C0MPUTE_API_KEY=c0k_...
```

Usage is billed to your c0mpute balance; with an empty balance the account falls back to a small free daily allowance.

## Usage

```ts
import { ChatC0mpute } from '@profullstack/langchain-c0mpute';

const llm = new ChatC0mpute({ model: 'auto', temperature: 0.3 });

const res = await llm.invoke([
  ['system', 'You are a concise assistant.'],
  ['human', 'Explain sealed-bid auctions in two sentences.'],
]);
console.log(res.content);
console.log(res.response_metadata.model_name); // the model that served it
```

### Streaming

```ts
for await (const chunk of await llm.stream('Write a haiku about spare GPUs.')) {
  process.stdout.write(String(chunk.content));
}
```

A job waits for an auction and a queue before a node starts it, so the first text can take several seconds, and it often arrives in a few large chunks.

### In a chain

```ts
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const chain = ChatPromptTemplate.fromTemplate('Summarize in one line: {text}')
  .pipe(new ChatC0mpute())
  .pipe(new StringOutputParser());

console.log(await chain.invoke({ text: 'c0mpute pays people for spare compute.' }));
```

### Options

`ChatC0mpute` extends `ChatOpenAICompletions` from `@langchain/openai`, so the usual fields work. c0mpute honors `model`, `temperature` and `maxTokens` (up to 8192).

| Option | Default |
| --- | --- |
| `model` | `auto` |
| `apiKey` | `C0MPUTE_API_KEY` env var |
| `baseURL` | `https://c0mpute.com/v1` |

## Models

`auto` lets the c0mpute router pick an open model per request; `auto:fast`, `auto:standard`, `auto:high` and `auto:max` set a speed / quality preference. You can also name a concrete model such as `qwen3:4b`, `qwen2.5-coder:7b`, `qwen3-coder:30b` or `devstral:24b`. Concrete models are only available while a node serving them is online: see the live list at [c0mpute.com/v1/models](https://c0mpute.com/v1/models). Under heavy load the API can answer `Network is busy`; `auto` is the most reliable choice.

## Limits

- Tool calling: `bindTools()` works on `auto` and tool-capable models (`qwen3:4b`, `nemotron-3-nano:4b`, `qwen2.5-coder:7b`, `qwen3-coder:30b`, ...), so tool-calling agents run. Other models answer 400. See https://c0mpute.com/docs#api.
- Text only: multi-part messages are joined into one string and image parts are dropped.
- Structured output is not enforced; ask for JSON and validate it yourself.
- Up to 200 messages and 200,000 characters per request.

## Run a node and earn

Have a spare CPU or GPU? Run a c0mpute node and get paid for the jobs it wins:

```bash
curl -fsSL https://c0mpute.com/install.sh | sh
```

Linux, macOS and Windows (WSL2). See [c0mpute.com/providers](https://c0mpute.com/providers).

## Development

```bash
npm install
npm test                                  # unit tests, no network
C0MPUTE_API_KEY=c0k_... npm run test:live # real calls
npm run build
```

## License

MIT. Made by [Profullstack](https://profullstack.com). See also [@profullstack/ai-sdk-c0mpute](https://www.npmjs.com/package/@profullstack/ai-sdk-c0mpute) for the Vercel AI SDK.
