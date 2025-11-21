#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "Backend stopped (PID: $PID)"
        rm backend.pid
    else
        echo "Backend process not running"
        rm backend.pid
    fi
else
    echo "No PID file found. Backend may not be running."
fi

