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
  <defs><radialGradient id="halo"><stop stop-color="#6154ba" stop-opacity=".42"/><stop offset="1" stop-color="#131727" stop-opacity="0"/></radialGradient><linearGradient id="rim" x2="100%" y2="100%"><stop stop-color="#627084"/><stop offset=".48" stop-color="#343851"/><stop offset="1" stop-color="#7357bc"/></linearGradient><linearGradient id="title"><stop stop-color="#ffffff"/><stop offset=".68" stop-color="#e0e7ff"/><stop offset="1" stop-color="#a4b6ff"/></linearGradient><clipPath id="textArea"><rect x="38" y="85" width="666" height="235"/></clipPath></defs>
  <rect x="2" y="2" width="996" height="426" rx="28" fill="url(#bg)" stroke="url(#rim)" stroke-width="3"/>
  <ellipse cx="810" cy="171" rx="285" ry="166" fill="url(#halo)"/>
  <g fill="url(#accent)"><rect x="40" y="38" width="6" height="20" rx="3"/><rect x="51" y="28" width="6" height="30" rx="3"/><rect x="62" y="34" width="6" height="24" rx="3"/></g>
  <g font-family="Segoe UI, Arial, sans-serif"><text x="85" y="53" fill="#fff" font-size="25" font-weight="700">${escape(data.status)}</text><text x="950" y="50" text-anchor="end" fill="#939bb6" font-size="15" letter-spacing="3">K4 MUSIC</text>
  <path d="M40 76H960" stroke="#30364b"/><path d="M40 76H270" stroke="url(#accent)" stroke-width="3"/>
  <g clip-path="url(#textArea)"><text x="40" y="135" fill="url(#title)" font-size="${data.title.length > 35 ? 28 : 36}" font-weight="700">${shorten(data.title, 43)}</text>
  <text x="40" y="177" fill="#c2cadf" font-size="24">${shorten(data.artist, 44)}</text>
  <text x="40" y="235" fill="#aab4cd" font-size="21">Pedido por <tspan fill="#d8ceff" font-weight="600">@${shorten(data.user, 30)}</tspan></text></g>
  <rect x="40" y="265" width="325" height="46" rx="12" fill="#1e2438" stroke="#394663"/><text x="57" y="295" fill="#d4dcff" font-size="20">Voz · ${shorten(data.channel, 19)}</text>
  <rect x="379" y="265" width="150" height="46" rx="12" fill="#1e2438" stroke="#394663"/><text x="454" y="295" text-anchor="middle" fill="#dedaf7" font-size="20">Fila · ${data.queue}</text>
  <rect x="727" y="87" width="226" height="226" rx="25" fill="url(#rim)"/>
  <rect x="730" y="90" width="220" height="220" rx="22" fill="#252b40"/>
  ${cover ? `<image x="730" y="90" width="220" height="220" clip-path="url(#cover)" href="data:image/png;base64,${cover.toString('base64')}"/>` : '<text x="840" y="215" text-anchor="middle" fill="#9B5CFF" font-size="60">♫</text>'}
  <rect x="40" y="348" width="910" height="12" rx="6" fill="#2b3047"/><rect x="40" y="348" width="${Math.max(1, 910 * progress)}" height="12" rx="6" fill="url(#accent)"/><circle cx="${40 + 910 * progress}" cy="354" r="17" fill="#9B5CFF" opacity=".21"/><circle cx="${40 + 910 * progress}" cy="354" r="10" fill="#9f8fff" stroke="#f5efff" stroke-width="3"/>
  <text x="40" y="393" fill="#e9ecf5" font-size="18">${time(data.elapsed)}</text><text x="950" y="393" text-anchor="end" fill="#9ca6c2" font-size="18">${data.duration ? time(data.duration) : 'Ao vivo / duração desconhecida'}</text></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
