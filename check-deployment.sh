#!/bin/bash

echo "🔍 Checking Cloudflare deployment..."

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first."
    exit 1
fi

echo "📊 Checking database status..."
wrangler d1 info memo-db

echo ""
echo "🗄️ Checking database tables..."
wrangler d1 execute memo-db --command "SELECT name FROM sqlite_master WHERE type='table';"

echo ""
echo "📝 Checking memos table structure..."
wrangler d1 execute memo-db --command "PRAGMA table_info(memos);"

echo ""
echo "🏷️ Checking tags table structure..."
wrangler d1 execute memo-db --command "PRAGMA table_info(tags);"

echo ""
echo "📊 Checking existing data..."
wrangler d1 execute memo-db --command "SELECT COUNT(*) as memo_count FROM memos;"
wrangler d1 execute memo-db --command "SELECT COUNT(*) as tag_count FROM tags;"

echo ""
echo "🏷️ Listing existing tags..."
wrangler d1 execute memo-db --command "SELECT * FROM tags;"

echo ""
echo "🧪 Testing API endpoints..."
echo "Creating a test memo..."
TEST_MEMO_ID=$(wrangler d1 execute memo-db --command "INSERT INTO memos (title, content, tags) VALUES ('Test Delete', 'This is a test memo for deletion', 'test'); SELECT last_insert_rowid();" | tail -1)

if [ ! -z "$TEST_MEMO_ID" ]; then
    echo "Created test memo with ID: $TEST_MEMO_ID"
    echo "Testing delete functionality..."
    wrangler d1 execute memo-db --command "DELETE FROM memos WHERE id = $TEST_MEMO_ID;"
    echo "Delete test completed"
else
    echo "Could not create test memo"
fi

echo ""
echo "✅ Database check complete!"
echo ""
echo "💡 If you see errors above, try running:"
echo "   wrangler d1 migrations apply memo-db"
echo ""
echo "🔧 To debug delete issues:"
echo "   1. Check the browser console for errors"
echo "   2. Open debug-delete.html in your browser"
echo "   3. Check Cloudflare Pages Functions logs"
