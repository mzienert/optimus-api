#!/bin/bash
setup_production() {
    echo "Setting up production environment..."
    
    # Install production dependencies
    npm ci --only=production
    
    # Build TypeScript
    npm run build
    
    # Create logs directory
    mkdir -p dist/logs
    
    # Start with PM2
    echo "Starting production server with PM2..."
    pm2 delete hyperexpress-typescript 2>/dev/null || true
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
}