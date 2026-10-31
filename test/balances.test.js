import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('balances', () => {
  let api;
  const newAccount = async (currency = 'USD') =>
    (await api.request('POST', '/accounts', { ownerName: 'B', currency })).body;
  const tx = (body) => api.request('POST', '/transactions', body);

  before(async () => { api = await startTestServer(); });
  after(() => api.close());

  it('returns account balance with in/out totals and reconciliation', async () => {
    const a = await newAccount();
    const b = await newAccount();
    await tx({ type: 'deposit', accountId: a.id, amount: 1000 });
    await tx({ type: 'withdrawal', accountId: a.id, amount: 250 });
    await tx({ type: 'transfer', accountId: a.id, counterpartyAccountId: b.id, amount: 100 });

    const res = await api.request('GET', `/balances/${a.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      { ...res.body },
      {
        accountId: a.id,
        currency: 'USD',
        balance: 650,
        ledgerBalance: 650,
        reconciled: true,
        totalIn: 1000,
        totalOut: 350,
        transactionCount: 3,
      },
    );

    const other = await api.request('GET', `/balances/${b.id}`);
    assert.equal(other.body.balance, 100);
    assert.equal(other.body.totalIn, 100);
  });

  it('ignores reversed transactions', async () => {
    const a = await newAccount();
    await tx({ type: 'deposit', accountId: a.id, amount: 500 });
    const { body: w } = await tx({ type: 'withdrawal', accountId: a.id, amount: 200 });
    await api.request('DELETE', `/transactions/${w.id}`);

    const res = await api.request('GET', `/balances/${a.id}`);
    assert.equal(res.body.balance, 500);
    assert.equal(res.body.transactionCount, 1);
    assert.equal(res.body.reconciled, true);
  });

  it('builds a statement with running balance', async () => {
    const a = await newAccount();
    await tx({ type: 'deposit', accountId: a.id, amount: 300 });
    await tx({ type: 'withdrawal', accountId: a.id, amount: 50 });
    await tx({ type: 'deposit', accountId: a.id, amount: 20 });

    const res = await api.request('GET', `/balances/${a.id}/history`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.entries.map((e) => [e.amount, e.balanceAfter]), [
      [300, 300],
      [-50, 250],
      [20, 270],
    ]);
    assert.equal(res.body.openingBalance, 0);
    assert.equal(res.body.closingBalance, 270);
  });

  it('validates history date filters', async () => {
    const a = await newAccount();
    assert.equal((await api.request('GET', `/balances/${a.id}/history?from=garbage`)).status, 400);
    assert.equal(
      (await api.request('GET', `/balances/${a.id}/history?from=2026-02-01&to=2026-01-01`)).status,
      400,
    );
    const future = await api.request('GET', `/balances/${a.id}/history?from=2999-01-01`);
    assert.equal(future.body.entries.length, 0);
  });

  it('aggregates totals per currency, skipping closed accounts', async () => {
    const gbp1 = await newAccount('GBP');
    const gbp2 = await newAccount('GBP');
    const closed = await newAccount('GBP');
    await tx({ type: 'deposit', accountId: gbp1.id, amount: 70 });
    await tx({ type: 'deposit', accountId: gbp2.id, amount: 30 });
    await api.request('PATCH', `/accounts/${closed.id}`, { status: 'closed' });

    const res = await api.request('GET', '/balances?currency=gbp');
    assert.deepEqual(res.body, [{ currency: 'GBP', total: 100, accountCount: 2 }]);
  });

  it('returns 404 for unknown accounts', async () => {
    assert.equal((await api.request('GET', '/balances/nope')).status, 404);
    assert.equal((await api.request('GET', '/balances/nope/history')).status, 404);
  });
});
