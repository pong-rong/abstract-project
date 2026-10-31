import { HttpError } from './lib/errors.js';
import { readJson, sendJson } from './lib/http.js';
import { createRouter } from './lib/router.js';
import { createStore } from './lib/store.js';
import { registerAccountRoutes } from './modules/accounts/accounts.routes.js';
import { createAccountsService } from './modules/accounts/accounts.service.js';
import { registerCardRoutes } from './modules/cards/cards.routes.js';
import { createCardsService } from './modules/cards/cards.service.js';
import { registerTransactionRoutes } from './modules/transactions/transactions.routes.js';
import { createTransactionsService } from './modules/transactions/transactions.service.js';

const METHODS_WITH_BODY = new Set(['POST', 'PATCH']);

export function createApp({ store = createStore(), logger = console } = {}) {
  const accounts = createAccountsService(store);
  const cards = createCardsService(store, accounts);
  const transactions = createTransactionsService(store, accounts, cards);
  const services = { accounts, cards, transactions };

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok' } }));
  registerAccountRoutes(router, services);
  registerCardRoutes(router, services);
  registerTransactionRoutes(router, services);

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const { handler, params, methodNotAllowed } = router.match(req.method, url.pathname);
      if (!handler) {
        throw new HttpError(methodNotAllowed ? 405 : 404, methodNotAllowed ? 'Method not allowed' : 'Route not found');
      }

      const body = METHODS_WITH_BODY.has(req.method) ? await readJson(req) : undefined;
      const query = Object.fromEntries(url.searchParams);
      const result = await handler({ params, query, body });
      sendJson(res, result.status ?? 200, result.body);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...(err.details && { details: err.details }) });
        return;
      }
      logger.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}
