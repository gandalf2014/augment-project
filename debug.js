// Debug script to test database connection and operations
// Run with: node debug.js

async function testDatabase() {
  console.log('🔍 Testing database operations...');
  
  try {
    // Test creating a memo via API
    const testMemo = {
      title: 'Test Memo',
      content: 'This is a test memo to verify the API is working.',
      tags: 'test, debug',
      is_favorite: false
    };
    
    console.log('📝 Testing memo creation...');
    const response = await fetch('http://localhost:8788/api/memos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMemo)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Memo created successfully:', result);
    } else {
      console.error('❌ Failed to create memo:', result);
    }
    
    // Test getting memos
    console.log('📋 Testing memo retrieval...');
    const getResponse = await fetch('http://localhost:8788/api/memos');
    const memos = await getResponse.json();
    
    if (getResponse.ok) {
      console.log('✅ Retrieved memos:', memos.length, 'memos found');
    } else {
      console.error('❌ Failed to retrieve memos:', memos);
    }
    
    // Test getting tags
    console.log('🏷️ Testing tag retrieval...');
    const tagsResponse = await fetch('http://localhost:8788/api/tags');
    const tags = await tagsResponse.json();
    
    if (tagsResponse.ok) {
      console.log('✅ Retrieved tags:', tags.length, 'tags found');
    } else {
      console.error('❌ Failed to retrieve tags:', tags);
    }
    
  } catch (error) {
    console.error('💥 Error during testing:', error.message);
  }
}

// Run the test
testDatabase();
