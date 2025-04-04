import express, { Request, Response } from 'express';
import callRoutes from './call.routes';

const router = express.Router();

// Add routes
router.use('/', callRoutes);

// Default route for API welcome message
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Inari Assistant API',
    version: '1.0.0',
  });
});

export default router;