/**
 * Production-safe logging utility
 * Only logs in development, sanitizes sensitive data
 * Uses sonner for user-facing notifications
 */

import { toast } from "sonner";

const isDevelopment = import.meta.env.DEV;

/**
 * Check if an object is a Supabase error object
 */
function isSupabaseError(error: unknown): error is { code?: string; message?: string; details?: string | null; hint?: string | null } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'message' in error)
  );
}

/**
 * Extract a user-friendly message from logger arguments
 */
function extractMessage(args: unknown[]): string | null {
  if (args.length === 0) return null;
  
  // Try to find a string message or error object
  for (const arg of args) {
    // Handle Supabase error objects
    if (isSupabaseError(arg)) {
      // Handle duplicate key constraint violation (PostgreSQL error code 23505)
      if (arg.code === '23505') {
        if (arg.message?.includes('returns-app_pkey') || arg.message?.includes('InvoiceNumber')) {
          return 'Invoice number already exists.';
        }
        return 'This record already exists. Please check your input and try again.';
      }
      
      // For other Supabase errors, use sanitizeErrorMessage to get user-friendly message
      return sanitizeErrorMessage(arg);
    }
    
    if (typeof arg === 'string' && arg.length > 0) {
      // Skip debug-only messages and error prefixes that are followed by explicit toast calls
      const debugPatterns = [
        'Error checking',
        'scan error',
        'Video play error',
        'capture start failed',
        'Fetching rows',
        'Fetched rows',
        'Images for invoice',
        'uploadGalleryItems results',
        'updateSalesData called',
        'Update successful',
        'Retrieved updated data',
        'Database updated',
        'Refreshing list',
        'Item selected',
        'handleUpdate called',
        'Upload error:',
        'Submission error:',
        'Update error',
        'Error signing out:',
        'Error fetching',
        'Error getting',
        'Sign in error:',
        'Sign out error:',
        'Supabase insert error:',
        'Supabase update error:',
        'Error downloading',
        'Error creating',
      ];
      
      if (debugPatterns.some(pattern => arg.includes(pattern))) {
        return null; // Debug-only, don't show toast
      }
      return arg;
    }
    if (arg instanceof Error) {
      // For Error objects, use sanitizeErrorMessage to get user-friendly message
      const userMessage = sanitizeErrorMessage(arg);
      // Only show if it's not a generic message (meaning it was sanitized)
      if (userMessage && userMessage !== 'An unexpected error occurred.') {
        return userMessage;
      }
      // For development, show the actual error message
      if (isDevelopment) {
        return arg.message;
      }
      return null;
    }
  }
  
  return null;
}

/**
 * Safe logger that logs to console in development and shows toast notifications
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Log to console in development
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, only log generic error messages to console
      console.error('An error occurred');
    }
    
    // Show toast notification for user-facing errors
    const message = extractMessage(args);
    if (message) {
      toast.error(message);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
    
    // Show toast notification for warnings
    const message = extractMessage(args);
    if (message) {
      toast.warning(message);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
    
    // Show toast notification for important info messages
    const message = extractMessage(args);
    if (message && (message.includes('successfully') || message.includes('completed'))) {
      toast.info(message);
    }
  },
};

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(error: unknown): string {
  // Handle Supabase error objects (not Error instances)
  if (isSupabaseError(error)) {
    // Handle duplicate key constraint violation (PostgreSQL error code 23505)
    if (error.code === '23505') {
      // Check if it's related to invoice number (returns-app_pkey)
      if (error.message?.includes('returns-app_pkey') || error.message?.includes('InvoiceNumber')) {
        return 'Invoice number already exists. Please use a different invoice number.';
      }
      // Generic duplicate key message
      return 'This record already exists. Please check your input and try again.';
    }
    
    // Handle permission errors
    if (error.code === '42501') {
      return 'You do not have permission to perform this action.';
    }
    
    // Use the error message if available
    if (error.message) {
      // Don't expose raw database error messages in production
      if (!isDevelopment) {
        // Check for common error patterns
        if (error.message.includes('network') || error.message.includes('fetch')) {
          return 'Network error. Please check your connection and try again.';
        }
        if (error.message.includes('permission') || error.message.includes('RLS')) {
          return 'You do not have permission to perform this action.';
        }
        if (error.message.includes('validation') || error.message.includes('invalid')) {
          return 'Invalid input. Please check your data and try again.';
        }
        // For duplicate key errors without code
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          return 'This record already exists. Please check your input and try again.';
        }
        return 'An error occurred. Please try again.';
      }
      return error.message;
    }
  }
  
  // Handle Error instances
  if (error instanceof Error) {
    // Don't expose internal error details in production
    if (isDevelopment) {
      return error.message;
    }
    
    // Generic messages for production
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.message.includes('permission') || error.message.includes('RLS') || error.message.includes('42501')) {
      return 'You do not have permission to perform this action.';
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'Invalid input. Please check your data and try again.';
    }
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint') || error.message.includes('23505')) {
      return 'Invoice number already exists. Please use a different invoice number.';
    }
    
    return 'An error occurred. Please try again.';
  }
  
  return 'An unexpected error occurred.';
}
