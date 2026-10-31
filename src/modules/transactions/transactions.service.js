import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import {
  optionalString,
  rejectUnknownFields,
  requireEnum,
  requirePositiveInt,
  requireString,
} from '../../lib/validation.js';

export const TRANSACTION_TYPES = ['deposit', 'withdrawal', 'transfer'];
export const TRANSACTION_STATUSES = ['completed', 'reversed'];

export function createTransactionsService(store, accounts, cards) {
  const { transactions } = store;

  function get(id) {
    const tx = transactions.get(id);
    if (!tx) throw notFound(`Transaction ${id} not found`);
    return tx;
  }

  function list({ accountId, type, status } = {}) {
    return [...transactions.values()].filter(
      (t) =>
        (!accountId || t.accountId === accountId || t.counterpartyAccountId === accountId) &&
        (!type || t.type === type) &&
        (!status || t.status === status),
    );
  }

  function ensureFunds(account, amount) {
    if (account.balance < amount) {
      throw unprocessable(`Insufficient funds on account ${account.id}`);
    }
  }

  function create(input) {
    rejectUnknownFields(input, [
      'type',
      'accountId',
      'amount',
      'counterpartyAccountId',
      'cardId',
      'description',
    ]);
    const type = requireEnum(input, 'type', TRANSACTION_TYPES);
    const accountId = requireString(input, 'accountId');
    const amount = requirePositiveInt(input, 'amount');
    const description = optionalString(input, 'description') ?? null;
    const account = accounts.requireActive(accountId);

    let counterpartyAccountId = null;
    let cardId = null;

    if (type === 'transfer') {
      counterpartyAccountId = requireString(input, 'counterpartyAccountId');
      if (counterpartyAccountId === accountId) {
        throw badRequest('Cannot transfer to the same account');
      }
      const counterparty = accounts.requireActive(counterpartyAccountId);
      if (counterparty.currency !== account.currency) {
        throw unprocessable('Cross-currency transfers are not supported');
      }
    } else if (input.counterpartyAccountId !== undefined) {
      throw badRequest('"counterpartyAccountId" is only allowed for transfers');
    }

    if (input.cardId !== undefined) {
      if (type !== 'withdrawal') {
        throw badRequest('"cardId" is only allowed for withdrawals');
      }
      cardId = requireString(input, 'cardId');
      const card = cards.get(cardId);
      if (card.accountId !== accountId) {
        throw unprocessable('Card does not belong to the account');
      }
      if (card.status !== 'active') {
        throw unprocessable(`Card ${cardId} is ${card.status}`);
      }
    }

    if (type === 'deposit') {
      accounts.applyDelta(accountId, amount);
    } else {
      ensureFunds(account, amount);
      accounts.applyDelta(accountId, -amount);
      if (type === 'transfer') accounts.applyDelta(counterpartyAccountId, amount);
    }

    const now = new Date().toISOString();
    const tx = {
      id: randomUUID(),
      type,
      accountId,
      counterpartyAccountId,
      cardId,
      amount,
      currency: account.currency,
      description,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    };
    transactions.set(tx.id, tx);
    return tx;
  }

  function update(id, input) {
    rejectUnknownFields(input, ['description']);
    const tx = get(id);
    const description = optionalString(input, 'description');
    if (description !== undefined) tx.description = description;
    tx.updatedAt = new Date().toISOString();
    return tx;
  }

  // Ledger entries are never physically deleted: DELETE reverses the transaction.
  function reverse(id) {
    const tx = get(id);
    if (tx.status === 'reversed') {
      throw conflict(`Transaction ${id} is already reversed`);
    }

    if (tx.type === 'deposit') {
      ensureFunds(accounts.get(tx.accountId), tx.amount);
      accounts.applyDelta(tx.accountId, -tx.amount);
    } else if (tx.type === 'withdrawal') {
      accounts.applyDelta(tx.accountId, tx.amount);
    } else {
      ensureFunds(accounts.get(tx.counterpartyAccountId), tx.amount);
      accounts.applyDelta(tx.counterpartyAccountId, -tx.amount);
      accounts.applyDelta(tx.accountId, tx.amount);
    }

    tx.status = 'reversed';
    tx.updatedAt = new Date().toISOString();
    return tx;
  }

  return { list, get, create, update, reverse };
}
