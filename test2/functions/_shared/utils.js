/**
 * Shared utility functions for Memo App
 */

/**
 * Generate a title from memo content
 * Strips markdown formatting and extracts the first meaningful sentence
 * @param {string} content - The memo content
 * @returns {string} - Generated title
 */
export function generateTitleFromContent(content) {
  if (!content) return 'Untitled Memo';

  // Remove markdown formatting for title generation
  let plainText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Remove bold+italic
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^#{1,6}\s+/gm, '') // Remove headers
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Get first meaningful line/sentence
  const firstLine = plainText.split(/[.!?]|\n/)[0].trim();

  // Limit length and add ellipsis if needed
  if (firstLine.length > 50) {
    return firstLine.substring(0, 47) + '...';
  }

  return firstLine || 'Untitled Memo';
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = { textContent: '' };
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Standard API response format
 */
export class ApiResponse {
  static success(data, status = 200) {
    return new Response(JSON.stringify({ success: true, data }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  static error(message, status = 500, code = 'ERROR') {
    return new Response(JSON.stringify({
      success: false,
      error: { code, message }
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}