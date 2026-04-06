@echo off
echo 🚀 Starting Memo App deployment...

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Wrangler CLI is not installed. Please install it first:
    echo npm install -g wrangler
    pause
    exit /b 1
)

REM Check if user is logged in
wrangler whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo 🔐 Please login to Cloudflare first:
    echo wrangler login
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
npm install

echo 🗄️ Setting up database...
echo Creating D1 database...
wrangler d1 create memo-db

echo ⚠️  Please update your wrangler.toml file with the database ID shown above
echo Press any key to continue after updating wrangler.toml...
pause >nul

echo 🔄 Running database migrations...
wrangler d1 migrations apply memo-db

echo 🌐 Deploying to Cloudflare Pages...
wrangler pages deploy public

echo ✅ Deployment complete!
echo Your Memo App should now be available at your Cloudflare Pages URL
pause
