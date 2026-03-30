/**
 * 仅 API：与 Nginx /api 反代配合。整站托管请用 full-site.mjs。
 */
import http from 'http';
import { serialized, handle } from './api-core.mjs';

const PORT = Number(process.env.PORT) || 8788;
const LISTEN_HOST = process.env.LISTEN_HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  serialized(() => handle(req, res));
});

server.listen(PORT, LISTEN_HOST, () => {
  console.log(`youximudi-api listening on http://${LISTEN_HOST}:${PORT}`);
});
