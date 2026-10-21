/** "ananya.joshi@studio.example" → "a•••@studio.example". Safe for logs. */
export function maskEmailAddress(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return '•••';
  return `${address.slice(0, 1)}•••@${address.slice(at + 1)}`;
}
