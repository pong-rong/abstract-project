import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import {
  optionalEnum,
  optionalString,
  rejectUnknownFields,
  requireString,
} from '../../lib/validation.js';

export const ACCOUNT_STATUSES = ['active', 'frozen', 'closed'];
const CURRENCY_RE = /^[A-Z]{3}$/;

export function createAccountsService(store) {
  const { accounts, cards } = store;

  function get(id) {
    const account = accounts.get(id);
    if (!account) throw notFound(`Account ${id} not found`);
    return account;
  }

  function requireActive(id) {
    const account = get(id);
    if (account.status !== 'active') {
      throw unprocessable(`Account ${id} is ${account.status}`);
    }
    return account;
  }

  function list({ status } = {}) {
    const all = [...accounts.values()];
    return status ? all.filter((a) => a.status === status) : all;
  }

  function create(input) {
    rejectUnknownFields(input, ['ownerName', 'currency']);
    const ownerName = requireString(input, 'ownerName');
    const currency = requireString(input, 'currency', { maxLength: 3 }).toUpperCase();
    if (!CURRENCY_RE.test(currency)) {
      throw badRequest('"currency" must be an ISO 4217 code, e.g. USD');
    }

    const now = new Date().toISOString();
    const account = {
      id: randomUUID(),
      ownerName,
      currency,
      balance: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    accounts.set(account.id, account);
    return account;
  }

  function update(id, input) {
    rejectUnknownFields(input, ['ownerName', 'status']);
    const account = get(id);
    const ownerName = optionalString(input, 'ownerName');
    const status = optionalEnum(input, 'status', ACCOUNT_STATUSES);

    if (account.status === 'closed') {
      throw conflict('Closed account cannot be modified');
    }
    if (status === 'closed' && account.balance !== 0) {
      throw conflict('Account with non-zero balance cannot be closed');
    }

    if (ownerName !== undefined) account.ownerName = ownerName;
    if (status !== undefined) account.status = status;
    account.updatedAt = new Date().toISOString();
    return account;
  }

  function remove(id) {
    const account = get(id);
    if (account.balance !== 0) {
      throw conflict('Account with non-zero balance cannot be deleted');
    }
    const hasCards = [...cards.values()].some((c) => c.accountId === id);
    if (hasCards) {
      throw conflict('Account has linked cards; delete them first');
    }
    accounts.delete(id);
  }

  // Internal: used by the transactions module only.
  function applyDelta(id, delta) {
    const account = get(id);
    account.balance += delta;
    account.updatedAt = new Date().toISOString();
    return account;
  }

  return { list, get, requireActive, create, update, remove, applyDelta };
}
