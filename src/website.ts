import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { installPrefix } from './prefix.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Client } from 'discord.js';

export function startWebsite(client?: Client, music?: ReturnType<typeof installPrefix>) {
  const token = randomBytes(32).toString('hex');
  const files: Record<string, [string, string]> = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/dashboard': ['dashboard.html', 'text/html; charset=utf-8'],
    '/dashboard.js': ['dashboard.js', 'text/javascript; charset=utf-8'],
    '/dashboard.css': ['dashboard.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  };
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const host = request.headers.host;
    if (!host || !['k4binho.js', 'localhost', '127.0.0.1'].includes(host)) {
      response.writeHead(403); response.end('Endereço não permitido.'); return;
    }
    if (pathname.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      try {
        if (request.method === 'GET' && pathname === '/api/status') {
          response.end(JSON.stringify({ ready: client?.isReady() ?? null })); return;
        }
        if (request.method === 'GET' && pathname === '/api/dashboard') {
          response.end(JSON.stringify({ token, available: !!music, ...(music?.snapshot() ?? {ready:false,guilds:[],settings:null}) })); return;
        }
        if (request.method !== 'POST') { response.writeHead(405); response.end('{}'); return; }
        const supplied = String(request.headers['x-k4-token'] ?? '');
        if (request.headers.origin !== 'http://' + host || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
          response.writeHead(403); response.end(JSON.stringify({error:'Recarregue o painel para autenticar esta sessão local.'})); return;
        }
        if (!music || !client?.isReady()) { response.writeHead(503); response.end(JSON.stringify({error:'O painel precisa iniciar junto com o bot conectado ao Discord.'})); return; }
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 4096) throw new Error('Pedido muito grande.');
        }
        const input = JSON.parse(body);
        if (pathname === '/api/settings') music.configure(input);
        else if (pathname === '/api/control') music.control(String(input.guildId), String(input.action), input.index);
        else { response.writeHead(404); response.end('{}'); return; }
        response.end(JSON.stringify({ok:true}));
      } catch (error) {
        response.writeHead(400); response.end(JSON.stringify({error:error instanceof Error ? error.message : 'Falha ao executar ação.'}));
      }
      return;
    }
    const file = files[pathname];
    if (!file) { response.writeHead(404); response.end('Página não encontrada.'); return; }
    try {
      const body = await readFile(new URL('../web/' + file[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': file[1] });
      response.end(body);
    } catch { response.writeHead(500); response.end('Não foi possível carregar a página.'); }
  });
  server.on('error', error => console.error('Página local indisponÃ­vel:', error.message));
  server.listen(80, '127.0.0.1', () => console.log('Página local em http://k4binho.js (também http://127.0.0.1).'));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startWebsite();
