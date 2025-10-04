#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting application..."

# Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# Start the Next.js application
echo "🌐 Starting Next.js server..."
npm start