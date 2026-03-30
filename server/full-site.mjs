/**
 * Windows / 无 Nginx 时：同进程提供静态站（仓库根目录）+ /api/*。
 * 环境变量：SITE_PORT（未设置时默认 80；Windows 与 youxijia 同机请设 59871，见 deploy/install-windows.ps1）、LISTEN_HOST（默认 0.0.0.0）。
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serialized, handle } from './api-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = path.resolve(path.join(__dirname, '..'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function safeJoin(root, urlPath) {
  const dec = decodeURIComponent(urlPath.split('?')[0]);
  const rel = path.normalize(dec.replace(/^\/+/, '')).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root))) return null;
  return full;
}

function serveStatic(req, res) {
  const u = new URL(req.url || '/', 'http://local');
  let pathname = u.pathname === '/' ? '/index.html' : u.pathname;
  const filePath = safeJoin(PUBLIC_ROOT, pathname);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

const SITE_PORT = Number(process.env.SITE_PORT) || 80;
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://local');
  if (u.pathname.startsWith('/api')) {
    serialized(() => handle(req, res));
    return;
  }
  serveStatic(req, res);
});

server.listen(SITE_PORT, LISTEN_HOST, () => {
  console.log(`youximudi full-site http://${LISTEN_HOST}:${SITE_PORT}`);
  console.log(`root ${PUBLIC_ROOT}`);
});

server.on('error', (e) => {
  console.error(e.message);
  if (e.code === 'EACCES') {
    console.error('绑定 80 端口通常需要「以管理员身份运行」。可设置 SITE_PORT=59871 并在现有反代上转发。');
  }
  process.exit(1);
});
