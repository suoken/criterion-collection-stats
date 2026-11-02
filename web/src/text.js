// Punctuation- and diacritic-insensitive form of a name or title, so
// "Chishû Ryû" matches "Chishu Ryu" and "J.R." matches "JR".
export function normalizeText(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
