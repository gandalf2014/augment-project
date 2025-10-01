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

// Dynamic route for individual memo operations
export async function onRequestPut(context) {
  const { env, request, params } = context;
  const id = params.id;
  
  console.log('PUT request - ID:', id);
  
  try {
    const { title, content, tags, is_favorite } = await request.json();

    // If no title provided, generate one from content
    const finalTitle = title && title.trim() ? title.trim() : generateTitleFromContent(content);
    
    // Update the memo
    const updateResult = await env.DB.prepare(`
      UPDATE memos
      SET title = ?, content = ?, tags = ?, is_favorite = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(finalTitle, content, tags || '', is_favorite || false, id).run();

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
  const { env, params } = context;
  const id = params.id;
  
  console.log('DELETE request - ID:', id);
  
  if (!id) {
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

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;
  
  console.log('GET request - ID:', id);
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'Invalid memo ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, tags, is_favorite, created_at, updated_at 
      FROM memos 
      WHERE id = ?
    `).bind(id).all();
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'Memo not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(results[0]), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching memo:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
