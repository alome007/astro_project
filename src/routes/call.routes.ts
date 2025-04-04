import express from 'express';
import { triggerOutboundCall, getCallStatus, handleInboundCall } from '../controllers/call.controller';
import { validateRequest } from '../middlewares/validator.middleware';
import { body } from 'express-validator';

const router = express.Router();

// Call routes
router.post(
  '/calls/outbound',
  [body('phone_number').isString().notEmpty().withMessage('Valid phone number is required')],
  validateRequest,
  triggerOutboundCall
);

router.get('/calls/status', getCallStatus);

router.post('/calls/inbound', handleInboundCall);

export default router;