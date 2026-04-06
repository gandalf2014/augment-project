#!/bin/bash

# Memo App Deployment Script
echo "🚀 Starting Memo App deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Setting up database..."
# Create database if it doesn't exist
echo "Creating D1 database..."
wrangler d1 create memo-db

echo "⚠️  Please update your wrangler.toml file with the database ID shown above"
echo "Press any key to continue after updating wrangler.toml..."
read -n 1 -s

echo "🔄 Running database migrations..."
wrangler d1 migrations apply memo-db

echo "🌐 Deploying to Cloudflare Pages..."
wrangler pages deploy public

echo "✅ Deployment complete!"
echo "Your Memo App should now be available at your Cloudflare Pages URL"
