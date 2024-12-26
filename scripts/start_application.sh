#!/bin/bash
cd /home/ec2-user/app
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PM2_HOME="/home/ec2-user/.pm2"

# Stop any existing instances
pm2 delete sentinel 2>/dev/null || true

# Start in production mode
pm2 start ecosystem.config.js --env production

# Ensure PM2 ownership
sudo chown -R ec2-user:ec2-user /home/ec2-user/.pm2