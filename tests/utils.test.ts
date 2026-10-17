import { describe, it, expect } from 'vitest'
import {
  formatBDT,
  formatDate,
  formatRollNumber,
  isValidEmail,
  isValidBDPhone,
  isValidStudentId,
  isStrongPassword,
} from '../src/utils'

describe('Utility Functions', () => {
  describe('formatters', () => {
    it('formats BDT currency with symbol and 2 decimals', () => {
      expect(formatBDT(1500)).toMatch(/৳\s?1,500\.00/)
      expect(formatBDT(0)).toMatch(/৳\s?0\.00/)
      expect(formatBDT(null)).toBe('৳0.00')
    })

    it('formats dates consistently', () => {
      const formatted = formatDate('2026-10-16T12:00:00Z')
      expect(formatted).toContain('2026')
      expect(formatted).toContain('Oct')
      expect(formatDate(null)).toBe('—')
    })

    it('pads roll numbers with leading zeroes', () => {
      expect(formatRollNumber(5)).toBe('005')
      expect(formatRollNumber(42, 4)).toBe('0042')
      expect(formatRollNumber(null)).toBe('—')
    })
  })

  describe('validators', () => {
    it('validates email addresses properly', () => {
      expect(isValidEmail('admin@evergreen.edu.bd')).toBe(true)
      expect(isValidEmail('student.123@domain.org')).toBe(true)
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('validates Bangladeshi phone numbers', () => {
      expect(isValidBDPhone('01712345678')).toBe(true)
      expect(isValidBDPhone('+8801812345678')).toBe(true)
      expect(isValidBDPhone('01912345678')).toBe(true)
      expect(isValidBDPhone('12345')).toBe(false)
      expect(isValidBDPhone('01212345678')).toBe(false) // 012 is invalid operator
    })

    it('validates student institutional IDs', () => {
      expect(isValidStudentId('STU-2026-0001')).toBe(true)
      expect(isValidStudentId('20260012')).toBe(true)
      expect(isValidStudentId('')).toBe(false)
    })

    it('checks strong password criteria', () => {
      expect(isStrongPassword('Secret123!').valid).toBe(true)
      expect(isStrongPassword('short1').valid).toBe(false)
      expect(isStrongPassword('nonumbershere').valid).toBe(false)
      expect(isStrongPassword('1234567890').valid).toBe(false)
    })
  })
})
