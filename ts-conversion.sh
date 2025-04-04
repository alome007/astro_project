#!/bin/bash

# Script to complete the TypeScript conversion

# Install dependencies
echo "Installing TypeScript dependencies..."
cd backend-node && npm install

# Remove old JS files
echo "Removing old JavaScript files..."
rm -f src/app.js
rm -f src/server.js
rm -f src/routes/index.js
rm -f src/routes/call.routes.js
rm -f src/middlewares/validator.middleware.js
rm -f src/middlewares/error.middleware.js
rm -f src/utils/logger.js
rm -f src/utils/twilio.utils.js
rm -f src/utils/google.utils.js
rm -f src/controllers/call.controller.js
rm -f src/services/websocket.service.js

# Build the TypeScript code
echo "Building TypeScript code..."
cd backend-node && npm run build

echo "TypeScript conversion complete!"
echo "You can now run the server with 'npm start' or development mode with 'npm run dev'"