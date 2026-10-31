import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('app', () => {
  let api;
  before(async () => { api = await startTestServer(); });
  after(() => api.close());

  it('serves health, 404 and 405', async () => {
    assert.deepEqual((await api.request('GET', '/health')).body, { status: 'ok' });
    assert.equal((await api.request('GET', '/unknown')).status, 404);
    assert.equal((await api.request('PUT', '/accounts')).status, 405);
  });
});
