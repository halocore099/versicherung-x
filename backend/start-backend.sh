#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

# Create logs directory if it doesn't exist
mkdir -p logs

# Start uvicorn in background
nohup uvicorn main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    > logs/backend.log 2>&1 &

# Save PID
echo $! > backend.pid
echo "Backend started with PID: $(cat backend.pid)"
echo "Logs: $SCRIPT_DIR/logs/backend.log"

