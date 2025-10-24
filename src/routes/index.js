import express from 'express';
const router = express.Router();

import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';

router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);

export default router;