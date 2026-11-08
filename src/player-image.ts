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
export async function playerImage(data: { title: string; artist: string; user: string; channel: string; status: string; elapsed: number; duration?: number; queue: number; next?: string; externalProgress?: boolean }, cover?: Buffer) {
  const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progress = data.duration ? Math.min(1, data.elapsed / data.duration) : 0;
  const svg = `<svg width="1000" height="480" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#1c2031"/><stop offset="1" stop-color="#090b14"/></linearGradient><linearGradient id="accent"><stop stop-color="#5865F2"/><stop offset="1" stop-color="#9B5CFF"/></linearGradient><clipPath id="cover"><rect x="730" y="90" width="220" height="220" rx="22"/></clipPath></defs>
  <defs><radialGradient id="halo"><stop stop-color="#6154ba" stop-opacity=".42"/><stop offset="1" stop-color="#131727" stop-opacity="0"/></radialGradient><linearGradient id="rim" x2="100%" y2="100%"><stop stop-color="#80adcf"/><stop offset=".48" stop-color="#343851"/><stop offset="1" stop-color="#9757dc"/></linearGradient><linearGradient id="title"><stop stop-color="#ffffff"/><stop offset=".68" stop-color="#e0e7ff"/><stop offset="1" stop-color="#64adff"/></linearGradient><clipPath id="textArea"><rect x="38" y="85" width="666" height="235"/></clipPath></defs>
  <rect x="2" y="2" width="996" height="476" rx="28" fill="url(#bg)" stroke="url(#rim)" stroke-width="3"/>
  <ellipse cx="810" cy="171" rx="285" ry="166" fill="url(#halo)"/>
  <g fill="url(#accent)"><rect x="40" y="38" width="6" height="20" rx="3"/><rect x="51" y="28" width="6" height="30" rx="3"/><rect x="62" y="34" width="6" height="24" rx="3"/></g>
  <g font-family="Segoe UI, Arial, sans-serif"><text x="85" y="53" fill="#fff" font-size="33" font-weight="700">${escape(data.status)}</text>
  <path d="M40 76H960" stroke="#30364b"/><path d="M40 76H410" stroke="url(#accent)" stroke-width="3"/>
  <g clip-path="url(#textArea)"><text x="40" y="135" fill="url(#title)" font-size="${data.title.length > 35 ? 28 : 36}" font-weight="700">${shorten(data.title, 43)}</text>
  <g fill="#9faacc"><circle cx="53" cy="168" r="7"/><path d="M40 186q0-14 13-14t13 14z"/></g><text x="77" y="188" fill="#c2cadf" font-size="24">${shorten(data.artist, 44)}</text>
  <circle cx="49" cy="226" r="6" fill="url(#accent)"/>
  <text x="70" y="234" fill="#bcc4de" font-size="24">Pedido por</text>
  <rect x="200" y="204" width="${Math.min(394, 44 + Array.from(data.user).length * 17)}" height="42" rx="16" fill="#302954" stroke="#615793"/>
  <text x="216" y="233" fill="#c2b7ff" font-size="23" font-weight="600">@${shorten(data.user, 22)}</text></g>
  <circle cx="49" cy="284" r="6" fill="url(#accent)"/>
  <rect x="69" y="261" width="310" height="46" rx="16" fill="#242640" stroke="#575781"/>
  <path d="M85 280h5l7-6v20l-7-6h-5z M102 278q6 6 0 12" fill="none" stroke="#b9baff" stroke-width="2.5" stroke-linejoin="round"/>
  <text x="116" y="292" fill="#d7dcff" font-size="22">${shorten(data.channel, 18)}</text>
  <rect x="395" y="261" width="183" height="46" rx="15" fill="#1b2030" stroke="#43495f"/>
  <path d="m411 281 11-6 11 6-11 6z m0 6 11 6 11-6" fill="none" stroke="#c9d2eb" stroke-width="2"/>
  <text x="445" y="292" fill="#d2d7eb" font-size="21">Na fila</text>
  <rect x="517" y="267" width="50" height="34" rx="8" fill="#1f304c"/>
  <text x="542" y="292" text-anchor="middle" fill="#84d9ff" font-size="21">${data.queue}</text>  <rect x="727" y="87" width="226" height="226" rx="25" fill="url(#rim)"/>
  <rect x="730" y="90" width="220" height="220" rx="22" fill="#252b40"/>
  ${cover ? `<image x="730" y="90" width="220" height="220" clip-path="url(#cover)" href="data:image/png;base64,${cover.toString('base64')}"/>` : '<text x="840" y="215" text-anchor="middle" fill="#9B5CFF" font-size="60">♫</text>'}
  <rect x="40" y="348" width="910" height="12" rx="6" fill="#2b3047"/><rect x="40" y="348" width="${Math.max(1, 910 * progress)}" height="12" rx="6" fill="url(#accent)"/><circle cx="${40 + 910 * progress}" cy="354" r="17" fill="#9B5CFF" opacity=".21"/><circle cx="${40 + 910 * progress}" cy="354" r="10" fill="#9f8fff" stroke="#f5efff" stroke-width="3"/>
  <text x="40" y="393" fill="#e9ecf5" font-size="18">${time(data.elapsed)}</text><text x="950" y="393" text-anchor="end" fill="#9ca6c2" font-size="18">${data.duration ? time(data.duration) : 'Ao vivo / duração desconhecida'}</text>
  <path d="M40 410H950" stroke="#30364b"/><text x="40" y="450" font-size="23" fill="#d8ceff">Próxima: <tspan fill="#e9ecf5">${shorten(data.next || 'Fila vazia', 58)}</tspan></text></g></svg>`;
  const layout = data.externalProgress ? svg.replace(/<rect x="40" y="348"[\s\S]*?(?=<path d="M40 410)/, '').replace('M40 410H950', 'M40 332H950').replace('y="450"', 'y="368"').replace('height="480"', 'height="400"').replace('height="476"', 'height="396"') : svg;
  return sharp(Buffer.from(layout)).png().toBuffer();
}
