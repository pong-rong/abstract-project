import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

export async function startTestServer() {
  const server = createServer(createApp({ logger: { error() {} } }));
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, body) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  }

  return {
    request,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
