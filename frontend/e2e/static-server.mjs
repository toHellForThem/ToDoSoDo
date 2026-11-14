/**
 * Минимальный статический сервер для E2E: раздаёт `expo export` без Express.
 * SPA-fallback отдаёт index.html для неизвестных путей.
 */

import { createStaticServer } from './static-server-lib.mjs';

const root = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 8081);

createStaticServer({ root, port });
