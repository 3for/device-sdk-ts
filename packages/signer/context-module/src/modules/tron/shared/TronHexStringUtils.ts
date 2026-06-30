export function normalizeHex(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X")
    ? value.slice(2)
    : value;
}
