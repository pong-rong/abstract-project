# bank-crud

Basic CRUD service for bank integration. Plain Node.js (>=20), no external dependencies, in-memory storage.

```bash
npm start      # http://localhost:3000 (PORT env to override)
npm test
```

## Modules

All amounts are integers in **minor units** (cents). Errors are returned as `{ "error": "..." }`.

### Accounts — `/accounts`

| Method | Path            | Description                                             |
|--------|-----------------|---------------------------------------------------------|
| GET    | `/accounts`     | List; filter `?status=active\|frozen\|closed`           |
| POST   | `/accounts`     | Create `{ ownerName, currency }`                        |
| GET    | `/accounts/:id` | Get one                                                 |
| PATCH  | `/accounts/:id` | Update `{ ownerName?, status? }`; can't close with funds |
| DELETE | `/accounts/:id` | Delete; requires zero balance and no linked cards       |

### Cards — `/cards`

| Method | Path         | Description                                                 |
|--------|--------------|-------------------------------------------------------------|
| GET    | `/cards`     | List; filter `?accountId=&status=active\|blocked`           |
| POST   | `/cards`     | Issue `{ accountId, holderName, type?: debit\|credit }`     |
| GET    | `/cards/:id` | Get one (only masked PAN / last4 is stored)                 |
| PATCH  | `/cards/:id` | Update `{ holderName?, status? }`                           |
| DELETE | `/cards/:id` | Delete                                                      |

### Transactions — `/transactions`

| Method | Path                | Description                                                                 |
|--------|---------------------|-----------------------------------------------------------------------------|
| GET    | `/transactions`     | List; filter `?accountId=&type=&status=`                                    |
| POST   | `/transactions`     | `{ type: deposit\|withdrawal\|transfer, accountId, amount, counterpartyAccountId?, cardId?, description? }` |
| GET    | `/transactions/:id` | Get one                                                                     |
| PATCH  | `/transactions/:id` | Update `{ description }` only                                               |
| DELETE | `/transactions/:id` | Reverse (ledger entries are never physically deleted)                       |

Rules: operations require an `active` account; withdrawals and transfers check funds; transfers must be same-currency; `cardId` (withdrawals only) must be an active card of that account.

## Layout

```
src/
  app.js                 # wiring + request handling
  server.js              # entry point
  lib/                   # router, http helpers, errors, validation, store
  modules/
    accounts/            # *.service.js (logic) + *.routes.js (HTTP)
    cards/
    transactions/
test/                    # node:test integration tests over HTTP
```
