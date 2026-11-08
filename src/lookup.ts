import { youtubeDl } from 'youtube-dl-exec';
type Video = { title: string; webpage_url: string; url?: string; id?: string; duration?: number; artist?: string; uploader?: string; channel?: string };
type SearchResult = Video & { entries?: Video[] };
const MAX_ACTIVE_SEARCHES = 2;
const MAX_WAITING_SEARCHES = 8;
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 40;
let activeSearches = 0;
const waiting: Array<() => void> = [];
const cache = new Map<string, { expires: number; value: SearchResult }>();
const inFlight = new Map<string, Promise<SearchResult>>();

async function acquireSearchSlot() {
  if (activeSearches < MAX_ACTIVE_SEARCHES) { activeSearches++; return; }
  if (waiting.length >= MAX_WAITING_SEARCHES) throw new Error('Há muitas buscas acontecendo agora. Aguarde um pouco e tente de novo.');
  // releaseSearchSlot transfers this occupied slot directly to the next waiter.
  await new Promise<void>(resolve => waiting.push(resolve));
}
function releaseSearchSlot() {
  const next = waiting.shift();
  if (next) next();
  else activeSearches--;
}

export function lookup(query: string): Promise<SearchResult> {
  const key = query.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    cache.delete(key); cache.set(key, cached);
    return Promise.resolve(cached.value);
  }
  if (cached) cache.delete(key);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = runLookup(query).then(value => {
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    return value;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

async function runLookup(query: string): Promise<SearchResult> {
  await acquireSearchSlot();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const proc = youtubeDl.exec(query, { dumpSingleJson: true, skipDownload: true, flatPlaylist: true, noPlaylist: true, quiet: true, socketTimeout: 8, retries: 1 }, { windowsHide: true });
    const output = await Promise.race([
      proc,
      new Promise<never>((_, reject) => { timer = setTimeout(() => { proc.kill(); reject(new Error('A busca demorou demais. Tente novamente ou envie o link do vídeo.')); }, 15000); }),
    ]);
    const data = JSON.parse(String(output.stdout)) as SearchResult;
    for (const entry of data.entries ?? []) entry.webpage_url ||= entry.url || `https://www.youtube.com/watch?v=${entry.id}`;
    return data;
  } finally { if (timer) clearTimeout(timer); releaseSearchSlot(); }
}
