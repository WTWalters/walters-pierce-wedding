#!/bin/bash

echo "🔧 Fixing Tailwind CSS v4 Issues..."
echo "=================================="
echo ""
echo "This script will downgrade from Tailwind CSS v4 (alpha) to v3 (stable)"
echo ""

# Step 1: Stop the dev server
echo "⚠️  Please stop your development server (Ctrl+C) before proceeding"
echo "Press Enter when ready..."
read

# Step 2: Clear caches
echo "📦 Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Step 3: Backup and replace files
echo "💾 Creating backups..."
cp package.json package.json.backup
cp postcss.config.mjs postcss.config.mjs.backup
cp app/globals.css app/globals.css.backup

echo "✏️  Applying fixes..."
mv package.json.fix package.json
mv postcss.config.mjs.fix postcss.config.mjs
mv app/globals.css.fix app/globals.css

# Step 4: Install dependencies
echo "📦 Installing dependencies..."
echo "This will take a few minutes..."
npm install

# Step 5: Start the dev server
echo ""
echo "✅ Fix applied!"
echo ""
echo "Now run: npm run dev"
echo "(Note: We removed --turbopack flag which may have been causing issues)"
echo ""
echo "If the issue persists, try:"
echo "1. Clear your browser cache"
echo "2. Open in an incognito/private window"
echo "3. Check browser console for errors"
