@echo off
echo 🔍 Checking Cloudflare deployment...

REM Check if wrangler is available
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Wrangler CLI not found. Please install it first.
    pause
    exit /b 1
)

echo 📊 Checking database status...
wrangler d1 info memo-db

echo.
echo 🗄️ Checking database tables...
wrangler d1 execute memo-db --command "SELECT name FROM sqlite_master WHERE type='table';"

echo.
echo 📝 Checking memos table structure...
wrangler d1 execute memo-db --command "PRAGMA table_info(memos);"

echo.
echo 🏷️ Checking tags table structure...
wrangler d1 execute memo-db --command "PRAGMA table_info(tags);"

echo.
echo 📊 Checking existing data...
wrangler d1 execute memo-db --command "SELECT COUNT(*) as memo_count FROM memos;"
wrangler d1 execute memo-db --command "SELECT COUNT(*) as tag_count FROM tags;"

echo.
echo 🏷️ Listing existing tags...
wrangler d1 execute memo-db --command "SELECT * FROM tags;"

echo.
echo 🧪 Testing delete functionality...
echo Creating test memo...
wrangler d1 execute memo-db --command "INSERT INTO memos (title, content, tags) VALUES ('Test Delete', 'This is a test memo for deletion', 'test');"

echo Getting test memo ID...
for /f "tokens=*" %%i in ('wrangler d1 execute memo-db --command "SELECT id FROM memos WHERE title='Test Delete' LIMIT 1;"') do set TEST_ID=%%i

if defined TEST_ID (
    echo Test memo ID: %TEST_ID%
    echo Testing delete...
    wrangler d1 execute memo-db --command "DELETE FROM memos WHERE title='Test Delete';"
    echo Delete test completed
) else (
    echo Could not create test memo
)

echo.
echo ✅ Database check complete!
echo.
echo 💡 If you see errors above, try running:
echo    wrangler d1 migrations apply memo-db
echo.
echo 🔧 To debug delete issues:
echo    1. Check the browser console for errors
echo    2. Open debug-delete.html in your browser
echo    3. Check Cloudflare Pages Functions logs
pause
