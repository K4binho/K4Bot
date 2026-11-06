import sharp from 'sharp';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const shorten = (s: string, n: number) => escape(s.length > n ? s.slice(0, n - 1) + '…' : s);
export async function coverImage(url: string): Promise<Buffer | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return;
    return await sharp(Buffer.from(await response.arrayBuffer())).resize(220, 220, { fit: 'cover' }).png().toBuffer();
  } catch { return undefined; }
}
export async function playerImage(data: { title: string; artist: string; user: string; channel: string; status: string; elapsed: number; duration?: number; queue: number }, cover?: Buffer) {
  const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progress = data.duration ? Math.min(1, data.elapsed / data.duration) : 0;
  const svg = `<svg width="1000" height="430" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#151925"/><stop offset="1" stop-color="#0B0D14"/></linearGradient><linearGradient id="accent"><stop stop-color="#5865F2"/><stop offset="1" stop-color="#9B5CFF"/></linearGradient><clipPath id="cover"><rect x="730" y="90" width="220" height="220" rx="22"/></clipPath></defs>
  <rect x="1" y="1" width="998" height="428" rx="28" fill="url(#bg)" stroke="#343952" stroke-width="2"/>
  <g fill="url(#accent)"><rect x="40" y="38" width="6" height="20" rx="3"/><rect x="51" y="28" width="6" height="30" rx="3"/><rect x="62" y="34" width="6" height="24" rx="3"/></g>
  <g font-family="Segoe UI, Arial, sans-serif"><text x="85" y="53" fill="#fff" font-size="25" font-weight="700">${escape(data.status)}</text><text x="950" y="50" text-anchor="end" fill="#939bb6" font-size="15" letter-spacing="3">K4 MUSIC</text>
  <path d="M40 76H960" stroke="#30364b"/>
  <text x="40" y="132" fill="#fff" font-size="29" font-weight="700">${shorten(data.title, 42)}</text>
  <text x="40" y="170" fill="#aeb7d0" font-size="20">${shorten(data.artist, 55)}</text>
  <text x="40" y="223" fill="#929bb7" font-size="17">PEDIDO POR</text><text x="40" y="251" fill="#c2b3ff" font-size="21">${shorten(data.user, 45)}</text>
  <rect x="40" y="275" width="390" height="38" rx="12" fill="#20263a"/><text x="57" y="300" fill="#b7c2fc" font-size="17">Voz · ${shorten(data.channel, 32)}</text>
  <text x="450" y="300" fill="#b8c0d5" font-size="17">${data.queue} na fila · YouTube</text>
  <rect x="730" y="90" width="220" height="220" rx="22" fill="#252b40"/>
  ${cover ? `<image x="730" y="90" width="220" height="220" clip-path="url(#cover)" href="data:image/png;base64,${cover.toString('base64')}"/>` : '<text x="840" y="215" text-anchor="middle" fill="#9B5CFF" font-size="60">♫</text>'}
  <rect x="40" y="350" width="910" height="8" rx="4" fill="#2b3047"/><rect x="40" y="350" width="${Math.max(8, 910 * progress)}" height="8" rx="4" fill="url(#accent)"/><circle cx="${40 + 910 * progress}" cy="354" r="8" fill="#e5ddff"/>
  <text x="40" y="393" fill="#e9ecf5" font-size="18">${time(data.elapsed)}</text><text x="950" y="393" text-anchor="end" fill="#9ca6c2" font-size="18">${data.duration ? time(data.duration) : 'Ao vivo / duração desconhecida'}</text></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
