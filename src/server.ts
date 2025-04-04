import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';

import app from './app';
import logger from './utils/logger';
import setupWebSocketHandlers from './services/websocket.service';

// Load environment variables
dotenv.config();

// Get port from environment and store in Express
const port = process.env.PORT || 3000;
app.set('port', port);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

// Set up WebSocket handlers
setupWebSocketHandlers(wss);

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Start listening
server.listen(port, () => {
  logger.info(`Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
});