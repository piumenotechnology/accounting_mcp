import express from 'express';
const router = express.Router();
import { requireAuth } from '../middlewares/auth.js';
import { ctrl } from '../controllers/referral.controller.js';


router.post('/', ctrl.createReferralToken);               // create referral
router.post('/use', requireAuth, ctrl.useReferralToken);     // use referral
router.delete('/delete', requireAuth, ctrl.revertReferralToken); // revert referral use

router.get('/:referral_id', requireAuth, ctrl.getReferralById); // get referral by id
router.get('/', ctrl.getReferrals);             // list referrals
router.delete('/:referral_id', requireAuth, ctrl.deleteReferral); // delete referral

export default router;