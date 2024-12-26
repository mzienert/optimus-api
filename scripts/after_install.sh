#!/bin/bash
cd /home/ec2-user/app

# Set up NVM environment
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install dependencies
npm install

# Create logs directory with proper permissions
sudo mkdir -p dist/logs
sudo chmod -R 755 .
sudo chmod -R 777 dist/logs

# Set proper ownership for the entire application directory
sudo chown -R ec2-user:ec2-user /home/ec2-user/app
sudo chown -R ec2-user:ec2-user dist/logs

# Ensure PM2 home directory has correct permissions
sudo mkdir -p /home/ec2-user/.pm2
sudo chown -R ec2-user:ec2-user /home/ec2-user/.pm2
sudo chmod -R 777 /home/ec2-user/.pm2

# Create log files if they don't exist and set permissions
sudo touch dist/logs/error.log
sudo touch dist/logs/out.log
sudo chmod 777 dist/logs/error.log
sudo chmod 777 dist/logs/out.log
sudo chown ec2-user:ec2-user dist/logs/error.log
sudo chown ec2-user:ec2-user dist/logs/out.log

# Allow Node.js to bind to port 80
sudo setcap 'cap_net_bind_service=+ep' $(which node)