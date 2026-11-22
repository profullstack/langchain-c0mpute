import { describe, expect, it } from 'vitest';
import { ChatC0mpute } from '../src/index';

const live = process.env.C0MPUTE_LIVE === '1' && !!process.env.C0MPUTE_API_KEY;

describe.skipIf(!live)('live c0mpute API', () => {
  it('invokes', async () => {
    const llm = new ChatC0mpute({ model: 'auto', maxTokens: 50 });
    const res = await llm.invoke('What is 7 times 6? Answer with just the number.');
    expect(String(res.content)).toContain('42');
  }, 240_000);

  it('streams', async () => {
    const llm = new ChatC0mpute({ model: 'auto', maxTokens: 60 });
    let text = '';
    for await (const c of await llm.stream('Count from 1 to 5 separated by spaces.')) text += c.content;
    expect(text).toMatch(/1.*2.*3/s);
  }, 240_000);
});
