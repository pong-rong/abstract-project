// In-memory storage. Swap for a real DB adapter with the same Map-like API.
export function createStore() {
  return {
    accounts: new Map(),
    cards: new Map(),
    transactions: new Map(),
  };
}
