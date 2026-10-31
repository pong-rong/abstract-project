export function registerBalanceRoutes(router, { balances }) {
  router.get('/balances', ({ query }) => ({
    body: balances.totals({ currency: query.currency?.toUpperCase() }),
  }));

  router.get('/balances/:accountId', ({ params }) => ({
    body: balances.getForAccount(params.accountId),
  }));

  router.get('/balances/:accountId/history', ({ params, query }) => ({
    body: balances.history(params.accountId, query),
  }));
}
