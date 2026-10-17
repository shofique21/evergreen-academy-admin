/**
 * Email format validation
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Bangladesh phone number validation (+8801XXXXXXXXX or 01XXXXXXXXX)
 */
export function isValidBDPhone(phone: string): boolean {
  if (!phone) return false
  const bdPhoneRegex = /^(?:\+8801|8801|01)[3-9]\d{8}$/
  return bdPhoneRegex.test(phone.replace(/[\s-]/g, ''))
}

/**
 * Student identifier validation (e.g. STU-2026-0001 or digits)
 */
export function isValidStudentId(identifier: string): boolean {
  if (!identifier) return false
  const idRegex = /^(?:STU-\d{4}-\d{3,6}|\d{4,10})$/i
  return idRegex.test(identifier.trim())
}

/**
 * Password strength check (min 8 chars, at least 1 letter and 1 number)
 */
export function isStrongPassword(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters.' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one letter.' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number.' }
  }
  return { valid: true }
}
