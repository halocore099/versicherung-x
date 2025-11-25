#!/bin/bash
# Script to rebuild and restart the backend container

echo "🔄 Rebuilding backend container..."
docker compose build backend

echo "🛑 Stopping backend container..."
docker compose down

echo "🚀 Starting backend container..."
docker compose up -d

echo "📋 Checking logs..."
docker logs versicherung-x-backend --tail 20

echo ""
echo "✅ Backend restarted! Check the logs above for CORS configuration."
echo "🧪 Test CORS with: curl -H 'Origin: https://versicherung.justcom.de' -v https://api.navitank.org/cors-test"
