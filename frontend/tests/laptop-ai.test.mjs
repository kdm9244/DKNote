import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laptopStatus, requireLaptop, resolveLocalModel, DEFAULT_LOCAL_MODEL } from '../src/services/laptopAi.js';

globalThis.sessionStorage = { getItem: () => 'test-token' };
test('laptop-only connection handles installed model, missing model, network failure and cancellation', async () => {
  const original = globalThis.fetch;
  try {
    assert.equal(resolveLocalModel('gemini-3.5-flash'), DEFAULT_LOCAL_MODEL);
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/ai/ollama/status');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return { ok: true, json: async () => ({ available: true, models: [{ name: DEFAULT_LOCAL_MODEL }] }) };
    };
    assert.equal((await laptopStatus(DEFAULT_LOCAL_MODEL)).status, 'online');
    assert.equal((await laptopStatus('missing')).status, 'offline');
    globalThis.fetch = async () => { throw new Error('connection refused'); };
    assert.equal((await laptopStatus()).status, 'offline');
    await assert.rejects(requireLaptop(), /노트북/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(requireLaptop(undefined, controller.signal), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});
