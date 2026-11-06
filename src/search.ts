export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}
export function selectTrack<T extends { title: string }>(query: string, entries: T[]): T | undefined {
  const terms = normalize(query).split(' ').filter(Boolean);
  const ranked = entries.map(entry => {
    const words = normalize(entry.title).split(' ');
    const scores = terms.map(term => Math.max(...words.map(word => {
      const d = distance(term, word);
      const allowance = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
      return d <= allowance ? 1 - d / Math.max(term.length, word.length) : 0;
    })));
    return { entry, score: scores.every(s => s > 0) ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 };
  }).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.8 ? ranked[0].entry : undefined;
}
