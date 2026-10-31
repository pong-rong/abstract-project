import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer } from './helpers.js';

describe('transactions', () => {
  let api;
  const balanceOf = async (id) => (await api.request('GET', `/accounts/${id}`)).body.balance;
  const newAccount = async (currency = 'USD') =>
    (await api.request('POST', '/accounts', { ownerName: 'T', currency })).body;

  before(async () => { api = await startTestServer(); });
  after(() => api.close());

  it('applies deposit, withdrawal and transfer to balances', async () => {
    const a = await newAccount();
    const b = await newAccount();

    assert.equal((await api.request('POST', '/transactions', { type: 'deposit', accountId: a.id, amount: 1000 })).status, 201);
    assert.equal((await api.request('POST', '/transactions', { type: 'withdrawal', accountId: a.id, amount: 300 })).status, 201);
    const transfer = await api.request('POST', '/transactions', {
      type: 'transfer', accountId: a.id, counterpartyAccountId: b.id, amount: 200,
    });
    assert.equal(transfer.status, 201);
    assert.equal(transfer.body.currency, 'USD');

    assert.equal(await balanceOf(a.id), 500);
    assert.equal(await balanceOf(b.id), 200);

    const history = await api.request('GET', `/transactions?accountId=${b.id}`);
    assert.equal(history.body.length, 1);
  });

  it('rejects insufficient funds, bad amounts and cross-currency transfers', async () => {
    const usd = await newAccount('USD');
    const eur = await newAccount('EUR');
    await api.request('POST', '/transactions', { type: 'deposit', accountId: usd.id, amount: 100 });

    assert.equal((await api.request('POST', '/transactions', { type: 'withdrawal', accountId: usd.id, amount: 101 })).status, 422);
    assert.equal((await api.request('POST', '/transactions', { type: 'deposit', accountId: usd.id, amount: 1.5 })).status, 400);
    assert.equal((await api.request('POST', '/transactions', { type: 'deposit', accountId: usd.id, amount: -5 })).status, 400);
    assert.equal(
      (await api.request('POST', '/transactions', { type: 'transfer', accountId: usd.id, counterpartyAccountId: eur.id, amount: 10 })).status,
      422,
    );
    assert.equal(await balanceOf(usd.id), 100);
  });

  it('rejects operations on frozen accounts and blocked cards', async () => {
    const acc = await newAccount();
    await api.request('POST', '/transactions', { type: 'deposit', accountId: acc.id, amount: 100 });
    const { body: card } = await api.request('POST', '/cards', { accountId: acc.id, holderName: 'T' });

    await api.request('PATCH', `/cards/${card.id}`, { status: 'blocked' });
    assert.equal(
      (await api.request('POST', '/transactions', { type: 'withdrawal', accountId: acc.id, amount: 10, cardId: card.id })).status,
      422,
    );

    await api.request('PATCH', `/accounts/${acc.id}`, { status: 'frozen' });
    assert.equal((await api.request('POST', '/transactions', { type: 'deposit', accountId: acc.id, amount: 10 })).status, 422);
  });

  it('updates description and reverses a transaction via DELETE', async () => {
    const a = await newAccount();
    const b = await newAccount();
    await api.request('POST', '/transactions', { type: 'deposit', accountId: a.id, amount: 500 });
    const { body: tx } = await api.request('POST', '/transactions', {
      type: 'transfer', accountId: a.id, counterpartyAccountId: b.id, amount: 150,
    });

    const patched = await api.request('PATCH', `/transactions/${tx.id}`, { description: 'rent' });
    assert.equal(patched.body.description, 'rent');
    assert.equal((await api.request('PATCH', `/transactions/${tx.id}`, { amount: 1 })).status, 400);

    const reversed = await api.request('DELETE', `/transactions/${tx.id}`);
    assert.equal(reversed.status, 200);
    assert.equal(reversed.body.status, 'reversed');
    assert.equal(await balanceOf(a.id), 500);
    assert.equal(await balanceOf(b.id), 0);

    assert.equal((await api.request('DELETE', `/transactions/${tx.id}`)).status, 409);
  });
});
