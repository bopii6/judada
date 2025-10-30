export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sampleWithoutReplacement<T>(items: T[], count: number): T[] {
  const pool = shuffle(items);
  return pool.slice(0, Math.min(count, pool.length));
}
