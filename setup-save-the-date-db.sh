#!/bin/bash

# Script to ensure database is properly set up for save-the-date form

echo "🔧 Setting up database for Save-the-Date form..."
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.local..."
    if [ -f .env.local ]; then
        cp .env.local .env
    else
        echo "❌ Neither .env nor .env.local found. Please create .env with DATABASE_URL"
        exit 1
    fi
fi

# Check for DATABASE_URL
if ! grep -q "DATABASE_URL" .env; then
    echo "❌ DATABASE_URL not found in .env file"
    echo "Please add: DATABASE_URL=\"postgresql://user:password@localhost:5432/dbname\""
    exit 1
fi

echo "✅ Environment variables found"
echo ""

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

echo ""
echo "🗄️  Checking database connection and schema..."

# Create migration if needed
npx prisma migrate dev --name add_save_the_date_support

echo ""
echo "✅ Database setup complete!"
echo ""
echo "The Guest table now includes:"
echo "  • firstName, lastName, email (unique)"
echo "  • phone (for US phone numbers)"
echo "  • addressLine1, city, state, zipCode"
echo "  • dietaryRestrictions"
echo "  • invitationCode (for RSVP matching)"
echo ""
echo "You can now test the save-the-date form at: /save-the-date"
