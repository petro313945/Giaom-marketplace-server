#!/bin/bash

# Giaom Marketplace Server PM2 Start Script
# Run this script from the server directory

set -e

echo "🚀 Starting Giaom Marketplace Server with PM2..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Install dependencies if node_modules don't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Stop existing PM2 process if running
pm2 stop giaom-server 2>/dev/null || true
pm2 delete giaom-server 2>/dev/null || true

# Start server with PM2
echo "▶️  Starting server..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ Server started successfully!"
echo ""
echo "📊 PM2 Status:"
pm2 status giaom-server
echo ""
echo "📝 Useful commands:"
echo "  - pm2 logs giaom-server   : View server logs"
echo "  - pm2 restart giaom-server: Restart server"
echo "  - pm2 stop giaom-server   : Stop server"
