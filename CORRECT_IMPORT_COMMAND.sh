#!/bin/bash
# Correct Firebase Auth Import Command for NEW Project
# Use the NEW project's hash parameters from Firebase Console

firebase auth:import users.json \
  --project versicherung-auth \
  --hash-algo=SCRYPT \
  --hash-key="OP4uKqYfjf1jFZ0+qWsr29gFlMdKAt30g6IPFyZc2nobI8U94GhqQH+x1L+NSSW9bmtH3aObRR5hif6jCo03mA==" \
  --salt-separator="Bw==" \
  --rounds=8 \
  --mem-cost=14

echo ""
echo "✅ Import complete!"
echo "📝 Note: If users still can't log in, they may need to reset their passwords"
echo "   (This can happen if the original export didn't preserve hashes correctly)"

