// Helper function to generate title from content
function generateTitleFromContent(content) {
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

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const tag = url.searchParams.get('tag') || '';
  const favorite = url.searchParams.get('favorite') === 'true';

  try {
    let query = `
      SELECT id, title, content, tags, is_favorite, created_at, updated_at 
      FROM memos 
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (tag) {
      query += ` AND tags LIKE ?`;
      params.push(`%${tag}%`);
    }

    if (favorite) {
      query += ` AND is_favorite = 1`;
    }

    query += ` ORDER BY updated_at DESC`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const { title, content, tags, is_favorite } = await request.json();

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If no title provided, generate one from content
    const finalTitle = title && title.trim() ? title.trim() : generateTitleFromContent(content);

    // Insert the memo
    const insertResult = await env.DB.prepare(`
      INSERT INTO memos (title, content, tags, is_favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(finalTitle, content, tags || '', is_favorite || false).run();

    if (!insertResult.success) {
      throw new Error('Failed to insert memo');
    }

    // Get the inserted memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, created_at, updated_at
      FROM memos
      WHERE id = ?
    `).bind(insertResult.meta.last_row_id).all();

    return new Response(JSON.stringify(results[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating memo:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const url = new URL(request.url);

  // Try to get ID from params first, then from URL
  let id = params?.id;
  if (!id) {
    const pathParts = url.pathname.split('/');
    id = pathParts[pathParts.length - 1];
  }

  console.log('PUT request - ID:', id, 'URL:', url.pathname);

  try {
    const { title, content, tags, is_favorite } = await request.json();

    // Update the memo
    const updateResult = await env.DB.prepare(`
      UPDATE memos
      SET title = ?, content = ?, tags = ?, is_favorite = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(title, content, tags || '', is_favorite || false, id).run();

    if (!updateResult.success || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Memo not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the updated memo
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, created_at, updated_at
      FROM memos
      WHERE id = ?
    `).bind(id).all();

    return new Response(JSON.stringify(results[0]), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating memo:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const url = new URL(request.url);

  // Try to get ID from params first, then from URL
  let id = params?.id;
  if (!id) {
    const pathParts = url.pathname.split('/');
    id = pathParts[pathParts.length - 1];
  }

  console.log('DELETE request - ID:', id, 'URL:', url.pathname);

  if (!id || id === 'memos') {
    return new Response(JSON.stringify({ error: 'Invalid memo ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await env.DB.prepare(`DELETE FROM memos WHERE id = ?`).bind(id).run();

    console.log('Delete result:', result);

    if (!result.success || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Memo not found or could not be deleted' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      message: 'Memo deleted successfully',
      deletedId: id,
      changes: result.meta.changes
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting memo:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
