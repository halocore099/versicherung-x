#!/bin/bash

# Production build script for Cloudflare Tunnel deployment
# This script uses .env.production if it exists, otherwise uses inline values

set -e

echo "Building frontend for production..."

# Use production environment
export NODE_ENV=production

# Load .env.production if it exists (Vite will automatically use it)
# You can also override values here if needed
if [ -f .env.production ]; then
    echo "📄 Using .env.production file"
    # Vite automatically loads .env.production during build
else
    echo "⚠️  .env.production not found, using inline values"
    # Fallback to inline values
    export VITE_API_URL="https://api.navitank.org"
    export VITE_API_PREFIX_PATH="/routes"
    export VITE_APP_TITLE="Versicherung X"
    export VITE_FIREBASE_CONFIG='{"apiKey":"AIzaSyAwK575ETVUNfbmRKVrPTH6hOv16d2pYtQ","authDomain":"versicherung-auth.firebaseapp.com","projectId":"versicherung-auth","storageBucket":"versicherung-auth.firebasestorage.app","messagingSenderId":"852377007234","appId":"1:852377007234:web:54df66bf3a1d372c55f09b"}'
    export VITE_FIREBASE_SITE_NAME="Versicherung X"
fi

# Build (Vite will automatically use .env.production in production mode)
npm run build

echo ""
echo "✅ Build complete!"
echo "📦 Upload contents of 'dist/' folder to ISPConfig"
echo "📁 Target directory: /var/www/navitank.org/versicherung-x/frontend/dist/"

