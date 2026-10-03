/**
 * Validation helpers placeholder for Classy application.
 * Detailed validation schemas will be expanded in future phases.
 */
export const isValidEgyptianPhone = (phone: string): boolean => {
  return /^01[0125][0-9]{8}$/.test(phone.trim())
}
