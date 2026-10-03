// Serves dist-web at http://localhost:8090/unstrung/app/, the folder it has on eyesunstrung.vip,
// so the web build can be tried the way it will be used.
//
//   npm run build:web
//   npm run serve:web
//
// Port 8090, so it does not clash with eyesunstrung's own dev server on 8080. Pass another port as
// an argument if needed: npm run serve:web -- 8091

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', 'dist-web');
const port = Number(process.argv[2]) || 8090;
const prefix = '/unstrung/app/';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.opus': 'audio/ogg'
};

http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/unstrung/app') {
        response.writeHead(302, { Location: prefix }).end();
        return;
    }
    if (!url.pathname.startsWith(prefix)) {
        response.writeHead(404).end('Not found');
        return;
    }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = path.join(root, relative);
    if (!file.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
    }
    try {
        const body = await fs.readFile(file);
        response.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
        response.end(body);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, () => console.log(`Serving dist-web at http://localhost:${port}${prefix}`));
