/**
 * Authentication utilities for Memo App
 */

/**
 * Simple hash function for password/token
 * Using SHA-256 via Web Crypto API
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a session token
 */
export async function generateToken(userId) {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const randomHex = randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${userId}:${randomHex}`;
}

/**
 * Verify session token and get user ID
 */
export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 2) return null;
  const userId = parseInt(parts[0]);
  if (isNaN(userId) || userId <= 0) return null;
  return userId;
}

/**
 * Get user ID from request (cookie or header)
 */
export function getUserIdFromRequest(request) {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }
  
  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (authCookie) {
      const token = authCookie.slice('auth_token='.length);
      return verifyToken(token);
    }
  }
  
  return null;
}

/**
 * Authentication middleware - returns error if not authenticated
 */
export async function requireAuth(context) {
  const userId = getUserIdFromRequest(context.request);
  if (!userId) {
    return { error: ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED'), userId: null };
  }
  return { error: null, userId };
}

import { ApiResponse } from './utils.js';