import { Router } from 'express';
import { supportController } from '../controllers/support.controller.js';

const router = Router();

/**
 * @route POST /api/support/contact
 * @desc Public contact form endpoint
 */
router.post('/contact', supportController.sendContactMessage);

export default router;
