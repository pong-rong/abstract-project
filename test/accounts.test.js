import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('accounts', () => {
  let api;
  before(async () => { api = await startTestServer(); });
  after(() => api.close());

  it('creates, reads, lists, updates and deletes an account', async () => {
    const created = await api.request('POST', '/accounts', { ownerName: 'Alice', currency: 'usd' });
    assert.equal(created.status, 201);
    assert.equal(created.body.currency, 'USD');
    assert.equal(created.body.balance, 0);
    assert.equal(created.body.status, 'active');

    const { id } = created.body;
    assert.equal((await api.request('GET', `/accounts/${id}`)).body.ownerName, 'Alice');
    assert.ok((await api.request('GET', '/accounts')).body.some((a) => a.id === id));

    const updated = await api.request('PATCH', `/accounts/${id}`, { ownerName: 'Alice B.', status: 'frozen' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.ownerName, 'Alice B.');
    assert.equal(updated.body.status, 'frozen');

    assert.equal((await api.request('DELETE', `/accounts/${id}`)).status, 204);
    assert.equal((await api.request('GET', `/accounts/${id}`)).status, 404);
  });

  it('validates input', async () => {
    assert.equal((await api.request('POST', '/accounts', { ownerName: '', currency: 'USD' })).status, 400);
    assert.equal((await api.request('POST', '/accounts', { ownerName: 'Bob', currency: 'US' })).status, 400);
    assert.equal((await api.request('POST', '/accounts', { ownerName: 'Bob', currency: 'USD', balance: 100 })).status, 400);
  });

  it('refuses to close or delete an account with balance', async () => {
    const { body: acc } = await api.request('POST', '/accounts', { ownerName: 'Carol', currency: 'EUR' });
    await api.request('POST', '/transactions', { type: 'deposit', accountId: acc.id, amount: 500 });

    assert.equal((await api.request('PATCH', `/accounts/${acc.id}`, { status: 'closed' })).status, 409);
    assert.equal((await api.request('DELETE', `/accounts/${acc.id}`)).status, 409);
  });
});
