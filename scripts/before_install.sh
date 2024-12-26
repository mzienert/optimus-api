#!/bin/bash
set -e

# Stop the application first
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PM2_HOME="/home/ec2-user/.pm2"

# Try to stop the application gracefully
pm2 delete sentinel || true

# Clean the application directory thoroughly
if [ -d "/home/ec2-user/app" ]; then
    # Remove all files including hidden ones
    rm -rf /home/ec2-user/app/{*,.*}
    
    # Clean npm cache
    npm cache clean --force
fi

# Recreate directory with proper permissions
mkdir -p /home/ec2-user/app
chown -R ec2-user:ec2-user /home/ec2-user/app
chmod -R 755 /home/ec2-user/app