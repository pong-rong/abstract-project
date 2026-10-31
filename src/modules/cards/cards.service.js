import { randomInt, randomUUID } from 'node:crypto';
import { notFound, unprocessable } from '../../lib/errors.js';
import {
  optionalEnum,
  optionalString,
  rejectUnknownFields,
  requireString,
} from '../../lib/validation.js';

export const CARD_TYPES = ['debit', 'credit'];
export const CARD_STATUSES = ['active', 'blocked'];
const CARD_VALIDITY_YEARS = 4;

// Full PAN is never stored: only last4 + masked form.
function generatePan() {
  let digits = '4';
  for (let i = 0; i < 15; i += 1) digits += randomInt(0, 10);
  return digits;
}

export function createCardsService(store, accounts) {
  const { cards } = store;

  function get(id) {
    const card = cards.get(id);
    if (!card) throw notFound(`Card ${id} not found`);
    return card;
  }

  function list({ accountId, status } = {}) {
    return [...cards.values()].filter(
      (c) => (!accountId || c.accountId === accountId) && (!status || c.status === status),
    );
  }

  function create(input) {
    rejectUnknownFields(input, ['accountId', 'holderName', 'type']);
    const accountId = requireString(input, 'accountId');
    const holderName = requireString(input, 'holderName');
    const type = optionalEnum(input, 'type', CARD_TYPES) ?? 'debit';

    const account = accounts.get(accountId);
    if (account.status === 'closed') {
      throw unprocessable('Cannot issue a card for a closed account');
    }

    const pan = generatePan();
    const now = new Date();
    const card = {
      id: randomUUID(),
      accountId,
      holderName,
      type,
      last4: pan.slice(-4),
      maskedPan: `${pan.slice(0, 4)} **** **** ${pan.slice(-4)}`,
      expMonth: now.getUTCMonth() + 1,
      expYear: now.getUTCFullYear() + CARD_VALIDITY_YEARS,
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    cards.set(card.id, card);
    return card;
  }

  function update(id, input) {
    rejectUnknownFields(input, ['holderName', 'status']);
    const card = get(id);
    const holderName = optionalString(input, 'holderName');
    const status = optionalEnum(input, 'status', CARD_STATUSES);

    if (holderName !== undefined) card.holderName = holderName;
    if (status !== undefined) card.status = status;
    card.updatedAt = new Date().toISOString();
    return card;
  }

  function remove(id) {
    get(id);
    cards.delete(id);
  }

  return { list, get, create, update, remove };
}
