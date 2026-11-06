import { youtubeDl } from 'youtube-dl-exec';
type Video = { title: string; webpage_url: string; url?: string; id?: string; duration?: number; artist?: string; uploader?: string; channel?: string };
export async function lookup(query: string): Promise<Video & { entries?: Video[] }> {
  const proc = youtubeDl.exec(query, { dumpSingleJson: true, skipDownload: true, flatPlaylist: true, noPlaylist: true, quiet: true, socketTimeout: 8, retries: 1 }, { windowsHide: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      proc,
      new Promise<never>((_, reject) => { timer = setTimeout(() => { proc.kill(); reject(new Error('A busca demorou demais. Tente novamente ou envie o link do vídeo.')); }, 15000); }),
    ]);
    const data = JSON.parse(String(output.stdout)) as Video & { entries?: Video[] };
    for (const entry of data.entries ?? []) entry.webpage_url ||= entry.url || `https://www.youtube.com/watch?v=${entry.id}`;
    return data;
  } finally { if (timer) clearTimeout(timer); }
}
