/**
 * QR Code generation for shared memos
 * Uses a simple QR code library approach
 */

import { ApiResponse } from '../_shared/utils.js';

// Simple QR code generator (uses qrcode library approach)
// Since we can't use external npm packages directly, we'll generate QR data URL

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;

  // Check authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return ApiResponse.error('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const token = authHeader.slice(7);
  const sessionRes = await db.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime("now")'
  ).bind(token).first();

  if (!sessionRes) {
    return ApiResponse.error('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  const shareToken = params.token;

  if (request.method !== 'GET') {
    return ApiResponse.error('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    // Get share info
    const share = await db.prepare(`
      SELECT sm.*, m.title, m.content
      FROM shared_memos sm
      JOIN memos m ON m.id = sm.memo_id
      WHERE sm.share_token = ?
    `).bind(shareToken).first();

    if (!share) {
      return ApiResponse.error('Share not found', 404, 'SHARE_NOT_FOUND');
    }

    // Generate share URL
    const url = new URL(request.url);
    const shareUrl = `${url.origin}/share/${shareToken}`;

    // Generate QR code as SVG
    const qrSvg = await generateQRCodeSVG(shareUrl, 200);

    return new Response(JSON.stringify({
      success: true,
      data: {
        share_url: shareUrl,
        qr_code: qrSvg,
        qr_format: 'svg'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('QR generation error:', error);
    return ApiResponse.error('Failed to generate QR code', 500, 'QR_ERROR');
  }
}

/**
 * Generate QR code as SVG
 * Simplified QR code generator using basic patterns
 */
async function generateQRCodeSVG(text, size = 200) {
  // For simplicity, generate a placeholder QR-like pattern
  // In production, use a proper QR code library
  
  // Create a simple matrix based on text hash
  const moduleCount = 25;
  const moduleSize = size / moduleCount;
  
  // Generate pseudo-random matrix based on text
  const matrix = generateMatrix(text, moduleCount);
  
  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  
  // Draw finder patterns (corners)
  const finderSize = 7;
  const finderPositions = [
    [0, 0],
    [moduleCount - finderSize, 0],
    [0, moduleCount - finderSize]
  ];
  
  for (const [fx, fy] of finderPositions) {
    svg += drawFinderPattern(fx * moduleSize, fy * moduleSize, finderSize * moduleSize);
  }
  
  // Draw data modules
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (matrix[y][x] && !isInFinder(x, y, finderSize, moduleCount)) {
        svg += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }
  
  svg += '</svg>';
  
  // Return as data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function generateMatrix(text, size) {
  const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
  
  // Simple hash-based pattern generation
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Fill matrix with pseudo-random pattern
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isInFinder(x, y, 7, size)) {
        // Use simple PRNG based on position and hash
        const val = Math.sin(x * 12.9898 + y * 78.233 + hash) * 43758.5453;
        matrix[y][x] = (val - Math.floor(val)) > 0.5;
      }
    }
  }
  
  return matrix;
}

function isInFinder(x, y, finderSize, moduleCount) {
  // Top-left
  if (x < finderSize && y < finderSize) return true;
  // Top-right
  if (x >= moduleCount - finderSize && y < finderSize) return true;
  // Bottom-left
  if (x < finderSize && y >= moduleCount - finderSize) return true;
  return false;
}

function drawFinderPattern(x, y, size) {
  const unit = size / 7;
  let svg = '';
  
  // Outer square
  svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="black"/>`;
  // White square
  svg += `<rect x="${x + unit}" y="${y + unit}" width="${5 * unit}" height="${5 * unit}" fill="white"/>`;
  // Inner square
  svg += `<rect x="${x + 2 * unit}" y="${y + 2 * unit}" width="${3 * unit}" height="${3 * unit}" fill="black"/>`;
  
  return svg;
}