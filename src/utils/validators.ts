/**
 * validators.ts — Input Validation Utilities
 *
 * Validators for Nigerian-specific inputs: NIN, email, phone, and text sanitization.
 */

/** Validate Nigerian National Identification Number (11 digits) */
export function validateNIN(nin: string): { valid: boolean; error?: string } {
  const cleaned = nin.replace(/\s/g, '');
  if (!cleaned) return { valid: false, error: 'NIN is required' };
  if (!/^\d+$/.test(cleaned)) return { valid: false, error: 'NIN must contain only digits' };
  if (cleaned.length !== 11) return { valid: false, error: 'NIN must be exactly 11 digits' };
  return { valid: true };
}

/** Validate email address */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return { valid: false, error: 'Please enter a valid email address' };
  return { valid: true };
}

/** Validate Nigerian phone number (format: 080/081/070/090/091 + 8 digits) */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned) return { valid: false, error: 'Phone number is required' };

  // Accept with or without country code
  const withoutCode = cleaned.replace(/^\+?234/, '0');
  
  if (!/^0[789][01]\d{8}$/.test(withoutCode)) {
    return { valid: false, error: 'Enter a valid Nigerian phone number (e.g. 08012345678)' };
  }
  return { valid: true };
}

/** Validate contact method — either email or phone */
export function validateContact(contact: string): { valid: boolean; error?: string } {
  const trimmed = contact.trim();
  if (!trimmed) return { valid: false, error: 'Please enter your WhatsApp number or email address' };

  // Determine if email or phone
  if (trimmed.includes('@')) {
    return validateEmail(trimmed);
  }
  return validatePhone(trimmed);
}

/** Sanitize text input — strip HTML tags (including script/style content) and trim */
export function sanitize(input: string): string {
  // First strip script and style blocks (tag + content)
  let cleaned = input.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Then strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  return cleaned.trim();
}

/** Validate a monetary amount */
export function validateAmount(value: string): { valid: boolean; amount: number; error?: string } {
  const cleaned = value.replace(/[₦,\s]/g, '');
  if (!cleaned) return { valid: false, amount: 0, error: 'Amount is required' };
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return { valid: false, amount: 0, error: 'Enter a valid amount' };
  return { valid: true, amount: num };
}
