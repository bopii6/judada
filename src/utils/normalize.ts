const trailingPunctuation = /[.!?]$/;

export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(trailingPunctuation, '')
    .toLowerCase();
}

export function isLooseMatch(userInput: string, expected: string, variants: string[] = []) {
  const normalizedUser = normalizeText(userInput);
  if (!normalizedUser) return false;

  const pool = [expected, ...variants];
  return pool.some(target => normalizeText(target) === normalizedUser);
}

export function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
