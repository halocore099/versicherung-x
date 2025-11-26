#!/bin/bash

# Production build script for Cloudflare Tunnel deployment
# This script uses .env.production if it exists, otherwise uses inline values

set -e

echo "Building frontend for production..."

# Use production environment
export NODE_ENV=production

# Load .env.production if it exists and export all VITE_ variables
# This ensures vite.config.ts can read them at config load time
if [ -f .env.production ]; then
    echo "📄 Using .env.production file"
    # Extract and export VITE_ variables, handling JSON values properly
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes if present
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')
        
        # Export the variable
        export "$key=$value"
    done < <(grep "^VITE_" .env.production)
    
    echo "✅ Loaded environment variables from .env.production"
    echo "   VITE_API_URL=${VITE_API_URL}"
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
# But we've also explicitly exported the vars so vite.config.ts can read them
npm run build

echo ""
echo "✅ Build complete!"
echo "📦 Upload contents of 'dist/' folder to ISPConfig"
echo "📁 Target directory: /var/www/navitank.org/versicherung-x/frontend/dist/"

