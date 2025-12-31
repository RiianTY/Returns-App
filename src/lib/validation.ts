/**
 * Input validation utilities for security
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_INPUT_LENGTH = 1000;
const MAX_ACCOUNT_NUMBER_LENGTH = 50;
const MAX_INVOICE_NUMBER_LENGTH = 50;
const MAX_R_NUMBER_LENGTH = 50;

// Type definitions for validation results
export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type ValidationResultWithValue<T> = ValidationResult & {
  sanitized?: T;
};

export type ValidationResultWithNumber = ValidationResult & {
  number?: number;
};

/**
 * Validate file size
 */
export function validateFileSize(size: number): ValidationResult {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }
  return { valid: true };
}

/**
 * Validate file type
 */
export function validateFileType(mimeType: string): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
    return { valid: false, error: 'Only image files (JPEG, PNG, WebP, GIF) are allowed' };
  }
  return { valid: true };
}

/**
 * Validate image blob by checking first bytes (magic numbers)
 */
export async function validateImageContent(blob: Blob): Promise<ValidationResult> {
  const arrayBuffer = await blob.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Check for common image file signatures
  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  
  if (!isJPEG && !isPNG && !isGIF && !isWebP) {
    return { valid: false, error: 'Invalid image file format' };
  }
  
  return { valid: true };
}

/**
 * Sanitize and validate account number
 * For overstock/damages: Must be exactly 3 letters followed by 3 numbers (uppercase)
 */
export function validateAccountNumber(accountNumber: string, strictFormat: boolean = false): ValidationResultWithValue<string> {
  if (!accountNumber || accountNumber.trim().length === 0) {
    return { valid: false, error: 'Account number is required' };
  }
  
  // Force uppercase
  const upper = accountNumber.trim().toUpperCase();
  
  if (strictFormat) {
    // For overstock/damages: Must be exactly 3 letters followed by 3 numbers
    const pattern = /^[A-Z]{3}[0-9]{3}$/;
    if (!pattern.test(upper)) {
      return { valid: false, error: 'Account number must be 3 letters followed by 3 numbers (e.g., ABC123)' };
    }
    return { valid: true, sanitized: upper };
  }
  
  // For other cases, use original validation
  if (upper.length > MAX_ACCOUNT_NUMBER_LENGTH) {
    return { valid: false, error: `Account number must be less than ${MAX_ACCOUNT_NUMBER_LENGTH} characters` };
  }
  
  // Allow alphanumeric and common separators
  const sanitized = upper.replace(/[^0-9A-Z\-_]/g, '');
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Account number contains invalid characters' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Sanitize and validate invoice number
 * For overstock/damages: Must be exactly 8 digits
 */
export function validateInvoiceNumber(invoiceNumber: string, strictFormat: boolean = false): ValidationResultWithValue<string> {
  if (!invoiceNumber || invoiceNumber.trim().length === 0) {
    return { valid: false, error: 'Invoice number is required' };
  }
  
  if (strictFormat) {
    // For overstock/damages: Must be exactly 8 digits
    const digitsOnly = invoiceNumber.trim().replace(/\D/g, '');
    if (digitsOnly.length !== 8) {
      return { valid: false, error: 'Invoice number must be exactly 8 digits' };
    }
    return { valid: true, sanitized: digitsOnly };
  }
  
  // For other cases, use original validation
  if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
    return { valid: false, error: `Invoice number must be less than ${MAX_INVOICE_NUMBER_LENGTH} characters` };
  }
  
  // Allow alphanumeric and common separators
  const sanitized = invoiceNumber.trim().replace(/[^0-9A-Za-z\-_]/g, '');
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Invoice number contains invalid characters' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Sanitize and validate R number
 * For overstock: Must be exactly 8 digits
 */
export function validateRNumber(rNumber: string, strictFormat: boolean = false): ValidationResultWithValue<string> {
  if (!rNumber || rNumber.trim().length === 0) {
    return { valid: false, error: 'R number is required' };
  }
  
  if (strictFormat) {
    // For overstock: Must be exactly 8 digits
    const digitsOnly = rNumber.trim().replace(/\D/g, '');
    if (digitsOnly.length !== 8) {
      return { valid: false, error: 'R number must be exactly 8 digits' };
    }
    return { valid: true, sanitized: digitsOnly };
  }
  
  // For other cases, use original validation
  if (rNumber.length > MAX_R_NUMBER_LENGTH) {
    return { valid: false, error: `R number must be less than ${MAX_R_NUMBER_LENGTH} characters` };
  }
  
  // Allow alphanumeric and common separators
  const sanitized = rNumber.trim().replace(/[^0-9A-Za-z\-_]/g, '');
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'R number contains invalid characters' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Sanitize text input (for notes, reasons, etc.)
 */
export function sanitizeTextInput(text: string, maxLength: number = MAX_INPUT_LENGTH): ValidationResultWithValue<string> {
  if (text.length > maxLength) {
    return { valid: false, error: `Text must be less than ${maxLength} characters` };
  }
  
  // Remove potentially dangerous characters but allow most text
  const sanitized = text.replace(/[<>]/g, '').trim();
  
  return { valid: true, sanitized };
}

/**
 * Validate numeric string
 */
export function validateNumericString(value: string): ValidationResultWithNumber {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: 'Value is required' };
  }
  
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return { valid: false, error: 'Value must be a valid number' };
  }
  
  return { valid: true, number: num };
}
