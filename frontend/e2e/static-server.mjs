/**
 * Минимальный статический сервер для E2E: раздаёт `expo export` без Express.
 * SPA-fallback отдаёт index.html для неизвестных путей.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const candidate = normalize(join(root, urlPath));

  // Не выходим за пределы каталога сборки.
  if (!candidate.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  const filePath =
    existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(root, 'index.html');

  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Static server: http://127.0.0.1:${port}\n`);
});
