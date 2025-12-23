/**
 * Authentication utilities for Supabase
 * This provides a structure for authentication - you'll need to implement
 * the actual auth flow based on your requirements
 */

import { supabase } from "./supabaseClient";
import { logger } from "./logger";

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    logger.error("Error checking authentication:", error);
    return false;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    logger.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error("Sign in error:", error);
      throw new Error("Invalid email or password");
    }

    return data;
  } catch (error) {
    logger.error("Sign in error:", error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error("Sign out error:", error);
      throw error;
    }
  } catch (error) {
    logger.error("Sign out error:", error);
    throw error;
  }
}

/**
 * Require authentication - use this as a wrapper for protected routes/components
 */
export async function requireAuth(): Promise<boolean> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    // Redirect to login or show error
    // You can customize this based on your routing setup
    return false;
  }
  return true;
}
