const DEFAULT_SLUG = "track";

export const slugify = (input: string): string => {
  if (!input.trim()) return DEFAULT_SLUG;
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "-")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || DEFAULT_SLUG;
};
