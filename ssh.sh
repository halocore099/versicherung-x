#!/bin/bash

SSH_USER="c334458versicherung"
SSH_HOST="k98j70.meinserver.io"
SSH_PORT=22

echo $SSH_PORT
echo $SSH_USER
echo $SSH_HOST

wait 1000

kitty ssh -p $SSH_PORT $SSH_USER@$SSH_HOST


