import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Client } from 'discord.js';

export function startWebsite(client?: Client) {
  const files: Record<string, [string, string]> = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  };
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/status') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ready: client?.isReady() ?? null }));
      return;
    }
    const file = files[pathname];
    if (!file) { response.writeHead(404); response.end('PÃ¡gina nÃ£o encontrada.'); return; }
    try {
      const body = await readFile(new URL('../web/' + file[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': file[1] });
      response.end(body);
    } catch { response.writeHead(500); response.end('NÃ£o foi possÃ­vel carregar a pÃ¡gina.'); }
  });
  server.on('error', error => console.error('PÃ¡gina local indisponÃ­vel:', error.message));
  server.listen(80, '127.0.0.1', () => console.log('PÃ¡gina local em http://k4binho.js (tambÃ©m http://127.0.0.1).'));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startWebsite();
