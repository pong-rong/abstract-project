import { optionalEnum } from '../../lib/validation.js';
import { CARD_STATUSES } from './cards.service.js';

export function registerCardRoutes(router, { cards }) {
  router.get('/cards', ({ query }) => ({
    body: cards.list({
      accountId: query.accountId,
      status: optionalEnum(query, 'status', CARD_STATUSES),
    }),
  }));

  router.post('/cards', ({ body }) => ({ status: 201, body: cards.create(body) }));

  router.get('/cards/:id', ({ params }) => ({ body: cards.get(params.id) }));

  router.patch('/cards/:id', ({ params, body }) => ({ body: cards.update(params.id, body) }));

  router.delete('/cards/:id', ({ params }) => {
    cards.remove(params.id);
    return { status: 204 };
  });
}
