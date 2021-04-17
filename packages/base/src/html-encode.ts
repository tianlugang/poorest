export function htmlEncode(text: string) {
  return text
    .replace(/&/g, "&")
    .replace(/\"/g, '"')
    .replace(/</g, "<")
    .replace(/>/g, ">");
}
