import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('cards', () => {
  let api;
  let account;
  before(async () => {
    api = await startTestServer();
    account = (await api.request('POST', '/accounts', { ownerName: 'Dave', currency: 'USD' })).body;
  });
  after(() => api.close());

  it('issues a card without exposing the full PAN', async () => {
    const res = await api.request('POST', '/cards', { accountId: account.id, holderName: 'DAVE D' });
    assert.equal(res.status, 201);
    assert.equal(res.body.type, 'debit');
    assert.equal(res.body.status, 'active');
    assert.match(res.body.maskedPan, /^\d{4} \*{4} \*{4} \d{4}$/);
    assert.equal(res.body.pan, undefined);
  });

  it('lists, updates and deletes cards', async () => {
    const { body: card } = await api.request('POST', '/cards', {
      accountId: account.id,
      holderName: 'DAVE D',
      type: 'credit',
    });

    const listed = await api.request('GET', `/cards?accountId=${account.id}`);
    assert.ok(listed.body.every((c) => c.accountId === account.id));

    const blocked = await api.request('PATCH', `/cards/${card.id}`, { status: 'blocked' });
    assert.equal(blocked.body.status, 'blocked');

    assert.equal((await api.request('DELETE', `/cards/${card.id}`)).status, 204);
    assert.equal((await api.request('GET', `/cards/${card.id}`)).status, 404);
  });

  it('rejects cards for unknown accounts', async () => {
    const res = await api.request('POST', '/cards', { accountId: 'nope', holderName: 'X' });
    assert.equal(res.status, 404);
  });
});
