export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function distance(a: string, b: string): number {
  let previous: number[] | undefined;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (previous && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], previous[j - 2] + 1);
    }
    previous = row;
    row = next;
  }
  return row[b.length];
}

const ignored = new Set(['do', 'da', 'de', 'dos', 'das', 'o', 'a', 'the', 'player']);
const termsFor = (text: string) => normalize(text).split(' ').filter(t => t && !ignored.has(t));
function phrases(tokens: string[]) {
  return tokens.flatMap((_, i) => [tokens[i], tokens.slice(i, i + 2).join(''), tokens.slice(i, i + 3).join('')]);
}
function similarity(a: string, b: string) {
  if (a === b) return 1;
  const edits = distance(a, b);
  const allowance = a.length >= 8 ? 3 : a.length >= 5 ? 2 : a.length >= 3 ? 1 : 0;
  return edits <= allowance ? Math.max(0, 1 - edits / Math.max(a.length, b.length)) : 0;
}
export function selectTrack<T extends { title: string; artist?: string; channel?: string; uploader?: string }>(query: string, entries: T[]): T | undefined {
  const terms = termsFor(query);
  if (!terms.length) return;
  const ranked = entries.map((entry, index) => {
    const title = normalize(entry.title);
    const metadata = [entry.title, entry.artist, entry.channel, entry.uploader].filter(Boolean).join(' ');
    const words = phrases(termsFor(metadata));
    // Joining adjacent query words also handles "mine craft" and "sub zero".
    const scores = terms.map((term, i) => {
      let best = 0;
      for (const word of words) {
        best = Math.max(best, similarity(term, word));
        if (i + 1 < terms.length) best = Math.max(best, similarity(term + terms[i + 1], word));
        if (i > 0) best = Math.max(best, similarity(terms[i - 1] + term, word));
      }
      return best;
    });
    const weight = terms.reduce((sum, term) => sum + Math.min(term.length, 8), 0);
    const score = scores.reduce((sum, value, i) => sum + value * Math.min(terms[i].length, 8), 0) / weight;
    const coverage = scores.filter(value => value >= 0.75).length / terms.length;
    const versionPenalty = ['cover', 'karaoke', 'reaction', 'react', 'slowed', 'sped up', 'instrumental', 'remix', 'ao vivo']
      .filter(version => title.includes(version) && !normalize(query).includes(version)).length * 0.07;
    return { entry, score, coverage, rank: score - versionPenalty - index * 0.001 };
  }).filter(item => item.coverage === 1 && item.score >= 0.82).sort((a, b) => b.rank - a.rank);
  return ranked[0]?.entry;
}

export function searchVariants(query: string): string[] {
  const normalized = normalize(query);
  const terms = termsFor(query);
  const variants = [normalized + ' musica', terms.join(' '), terms.join(' ') + ' official audio'];
  // Broader retrieval still gets ranked against the entire original request.
  if (terms.length >= 3) {
    variants.push(terms.slice(0, -1).join(' '), terms.slice(1).join(' '));
  }
  return [...new Set(variants)].filter(value => value && value !== normalized).slice(0, 4);
}
