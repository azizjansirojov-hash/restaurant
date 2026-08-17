/** Uzbekistan mobile: +998 XX XXX XX XX (9 digits after country code). */
const UZ_MOBILE_DIGITS = 9;
const UZ_COUNTRY = '998';

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Convert user input to E.164 (+998XXXXXXXXX). */
export function toE164(phone: string): string {
  let digits = digitsOnly(phone);
  if (digits.startsWith(UZ_COUNTRY) && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === UZ_MOBILE_DIGITS) {
    return `+${UZ_COUNTRY}${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+${UZ_COUNTRY}${digits.slice(1)}`;
  }
  return digits.startsWith('+') ? phone.trim() : `+${digits}`;
}

export function isValidUzMobile(phone: string): boolean {
  const digits = digitsOnly(phone);
  if (digits.length === UZ_MOBILE_DIGITS) return true;
  if (digits.startsWith(UZ_COUNTRY) && digits.length === 12) return true;
  if (digits.startsWith('0') && digits.length === 10) return true;
  return false;
}

/** Display format: +998 90 123 45 67 */
export function formatPhoneDisplay(phone: string): string {
  const e164 = toE164(phone);
  const digits = digitsOnly(e164);
  if (digits.length !== 12 || !digits.startsWith(UZ_COUNTRY)) return phone;
  const local = digits.slice(3);
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** Mask partial input for TextField placeholder guidance. */
export function phoneInputPlaceholder(): string {
  return '90 123 45 67';
}
