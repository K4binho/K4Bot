import { lookup } from './lookup.js';
import { normalize, selectTrack } from './search.js';

export async function resolveSpotifyTrack(url: URL): Promise<Awaited<ReturnType<typeof lookup>>> {
  const id = /^\/(?:intl-[a-z-]+\/)?track\/([a-zA-Z0-9]{22})\/?$/.exec(url.pathname)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || !id) {
    throw new Error('Envie um link de faixa individual do Spotify.');
  }
  const response = await fetch(`https://open.spotify.com/embed/track/${id}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Não consegui consultar essa faixa do Spotify. Tente novamente.');
  const html = await response.text();
  const json = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  const entity = json ? JSON.parse(json)?.props?.pageProps?.state?.data?.entity : undefined;
  const title = entity?.title;
  const artists = entity?.artists?.map((artist: { name?: string }) => artist.name).filter((name: unknown): name is string => typeof name === 'string') as string[] | undefined;
  if (typeof title !== 'string' || !artists?.length) throw new Error('Spotify não informou título e artista dessa faixa.');
  const result = await lookup(`ytsearch15:${title} ${artists.join(' ')} official audio`);
  const artistWords = artists.flatMap(artist => normalize(artist).split(' ')).filter(word => word.length >= 4 && !['music', 'official'].includes(word));
  const candidates = (result.entries ?? []).filter(entry => {
    const metadata = normalize([entry.title, entry.channel, entry.artist, entry.uploader].join(' '));
    const artistMatches = artistWords.some(word => metadata.split(' ').includes(word));
    const durationMatches = typeof entity.duration !== 'number' || !entry.duration ||
      Math.abs(entry.duration - entity.duration / 1000) <= 25;
    return artistMatches && durationMatches;
  });
  const match = selectTrack(title, candidates);
  if (!match) throw new Error(`Encontrei "${title}" no Spotify, mas não achei uma versão correspondente no YouTube. Envie o link do vídeo.`);
  return match;
}
