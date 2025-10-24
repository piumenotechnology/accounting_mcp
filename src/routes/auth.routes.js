import express from 'express';
const router = express.Router();

import {requireAuth} from '../middlewares/auth.js';
import { auth } from '../controllers/auth.controller.js';

router.post("/login", auth.googleLogin);
router.post("/refresh", requireAuth, auth.refresh);
router.post("/logout", requireAuth, auth.logoutGoogle);
router.post("/mobile-exchange", auth.consentUser)

export default router;

