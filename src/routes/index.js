import express from 'express';
const router = express.Router();

import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';
import referralRoutes from './referral.routes.js';

router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/referral', referralRoutes);

export default router;