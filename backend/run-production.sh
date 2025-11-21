#!/bin/bash

# Production run script for FastAPI backend
# This script should be used by systemd service

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

# Run uvicorn in production mode (no reload, bind to localhost only)
# Adjust workers based on your server capacity (CPU cores)
uvicorn main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --log-level info \
    --access-log \
    --no-server-header

