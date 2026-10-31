import { badRequest } from '../../lib/errors.js';

// Signed effect of a completed transaction on the given account; 0 if unrelated.
function effectOn(tx, accountId) {
  if (tx.status !== 'completed') return 0;
  if (tx.type === 'deposit') return tx.accountId === accountId ? tx.amount : 0;
  if (tx.type === 'withdrawal') return tx.accountId === accountId ? -tx.amount : 0;
  if (tx.accountId === accountId) return -tx.amount;
  if (tx.counterpartyAccountId === accountId) return tx.amount;
  return 0;
}

function parseDate(value, field) {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`"${field}" must be an ISO 8601 date`);
  }
  return date.toISOString();
}

export function createBalancesService(store, accounts) {
  const { transactions } = store;

  // Map preserves insertion order, which is the ledger's chronological order.
  function ledgerFor(accountId) {
    const entries = [];
    for (const tx of transactions.values()) {
      const delta = effectOn(tx, accountId);
      if (delta !== 0) entries.push({ tx, delta });
    }
    return entries;
  }

  function getForAccount(accountId) {
    const account = accounts.get(accountId);
    let totalIn = 0;
    let totalOut = 0;
    const entries = ledgerFor(accountId);

    for (const { delta } of entries) {
      if (delta > 0) totalIn += delta;
      else totalOut -= delta;
    }

    const ledgerBalance = totalIn - totalOut;
    return {
      accountId,
      currency: account.currency,
      balance: account.balance,
      ledgerBalance,
      reconciled: ledgerBalance === account.balance,
      totalIn,
      totalOut,
      transactionCount: entries.length,
    };
  }

  function history(accountId, query = {}) {
    const account = accounts.get(accountId);
    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');
    if (from && to && from > to) {
      throw badRequest('"from" must not be after "to"');
    }

    let running = 0;
    let openingBalance = 0;
    const entries = [];

    for (const { tx, delta } of ledgerFor(accountId)) {
      running += delta;
      if (from && tx.createdAt < from) {
        openingBalance = running;
        continue;
      }
      if (to && tx.createdAt > to) break;
      entries.push({
        transactionId: tx.id,
        type: tx.type,
        amount: delta,
        balanceAfter: running,
        description: tx.description,
        createdAt: tx.createdAt,
      });
    }

    return {
      accountId,
      currency: account.currency,
      from: from ?? null,
      to: to ?? null,
      openingBalance,
      closingBalance: entries.length > 0 ? entries.at(-1).balanceAfter : openingBalance,
      entries,
    };
  }

  function totals({ currency } = {}) {
    const byCurrency = new Map();
    for (const account of accounts.list()) {
      if (account.status === 'closed') continue;
      if (currency && account.currency !== currency) continue;
      const row = byCurrency.get(account.currency) ?? {
        currency: account.currency,
        total: 0,
        accountCount: 0,
      };
      row.total += account.balance;
      row.accountCount += 1;
      byCurrency.set(account.currency, row);
    }
    return [...byCurrency.values()];
  }

  return { getForAccount, history, totals };
}
