const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export type PhoneNumberE164 = string & { readonly __brand: 'PhoneNumberE164' };

export function isPhoneNumberE164(value: string): value is PhoneNumberE164 {
  return E164_PATTERN.test(value);
}

/**
 * Builds an E.164 number from a country calling code ("91") and the national
 * number the person typed. Spaces, dashes, brackets and one leading trunk "0"
 * are removed. Returns null when the result is not a plausible E.164 number.
 */
export function toPhoneNumberE164(
  countryCallingCode: string,
  nationalNumber: string,
): PhoneNumberE164 | null {
  const countryDigits = countryCallingCode.replace(/\D/g, '');
  let nationalDigits = nationalNumber.replace(/\D/g, '');
  if (nationalDigits.startsWith(countryDigits) && nationalDigits.length > 10) {
    nationalDigits = nationalDigits.slice(countryDigits.length);
  }
  if (nationalDigits.startsWith('0')) nationalDigits = nationalDigits.slice(1);
  const candidate = `+${countryDigits}${nationalDigits}`;
  return isPhoneNumberE164(candidate) ? candidate : null;
}

/** "+919876543210" → "+91 •••••• 3210". Safe for logs and confirmations. */
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 8) return '••••';
  const lastFour = phone.slice(-4);
  const prefix = phone.startsWith('+91') ? '+91' : phone.slice(0, 3);
  return `${prefix} •••••• ${lastFour}`;
}
