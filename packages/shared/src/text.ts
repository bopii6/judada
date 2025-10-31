const punctuationRegex = /[.!?]/g;
const whitespaceRegex = /\s+/g;

export const normalizeForCompare = (value: string) =>
  value
    .trim()
    .replace(punctuationRegex, "")
    .replace(whitespaceRegex, " ")
    .toLowerCase();
