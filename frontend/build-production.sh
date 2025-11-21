#!/bin/bash

# Production build script for Cloudflare Tunnel deployment
# This builds the frontend with relative API paths

set -e

echo "Building frontend for production..."

# Use production environment
export NODE_ENV=production

# Set relative paths (works with Cloudflare Tunnel)
export VITE_API_URL=""
export VITE_API_PATH=""
export VITE_API_HOST=""
export VITE_API_PREFIX_PATH="/routes"
export VITE_APP_BASE_PATH="/"
export VITE_APP_TITLE="Versicherung X"

# Build
yarn build

echo ""
echo "✅ Build complete!"
echo "📦 Upload contents of 'dist/' folder to your frontend server"
echo "📁 Target directory: ~/versicherung-x/frontend/"

