import { optionalEnum } from '../../lib/validation.js';
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from './transactions.service.js';

export function registerTransactionRoutes(router, { transactions }) {
  router.get('/transactions', ({ query }) => ({
    body: transactions.list({
      accountId: query.accountId,
      type: optionalEnum(query, 'type', TRANSACTION_TYPES),
      status: optionalEnum(query, 'status', TRANSACTION_STATUSES),
    }),
  }));

  router.post('/transactions', ({ body }) => ({ status: 201, body: transactions.create(body) }));

  router.get('/transactions/:id', ({ params }) => ({ body: transactions.get(params.id) }));

  router.patch('/transactions/:id', ({ params, body }) => ({
    body: transactions.update(params.id, body),
  }));

  router.delete('/transactions/:id', ({ params }) => ({
    body: transactions.reverse(params.id),
  }));
}
