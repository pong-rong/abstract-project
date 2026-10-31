import { optionalEnum } from '../../lib/validation.js';
import { ACCOUNT_STATUSES } from './accounts.service.js';

export function registerAccountRoutes(router, { accounts }) {
  router.get('/accounts', ({ query }) => ({
    body: accounts.list({ status: optionalEnum(query, 'status', ACCOUNT_STATUSES) }),
  }));

  router.post('/accounts', ({ body }) => ({ status: 201, body: accounts.create(body) }));

  router.get('/accounts/:id', ({ params }) => ({ body: accounts.get(params.id) }));

  router.patch('/accounts/:id', ({ params, body }) => ({
    body: accounts.update(params.id, body),
  }));

  router.delete('/accounts/:id', ({ params }) => {
    accounts.remove(params.id);
    return { status: 204 };
  });
}
