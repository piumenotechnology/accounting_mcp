import { referralModels as model } from '../models/referral.models.js';

export const ctrl = {
  createReferralToken: async (req, res) => {
    try {
      const { referral, qty, schema_name, client_name } = req.body;

      if (!referral || typeof referral !== 'string' || !referral.trim()) {
        return res.status(400).json({ error: 'referral is required' });
      }

      const qtyNum = Number.isFinite(parseInt(qty, 10)) ? parseInt(qty, 10) : 0;
      if (qtyNum < 0) {
        return res.status(400).json({ error: 'qty must be a non negative integer' });
      }

      if (!schema_name || typeof schema_name !== 'string') {
        return res.status(400).json({ error: 'schema_name must be a valid object' });
      }

      if (!client_name || typeof client_name !== 'string') {
        return res.status(400).json({ error: 'client_name must be a valid string' });
      }
      
      const data = await model.createReferralToken(referral.trim(), qtyNum, schema_name, client_name);
      return res.status(201).json({ data });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  useReferralToken: async (req, res) => {
    try {
      const user_id = req.user.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { referral } = req.body;
      if (!referral) {
        return res.status(400).json({ error: 'referral and user_id are required' });
      }
      const data = await model.useReferralToken(referral.trim(), user_id);
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  revertReferralToken: async (req, res) => {
    try {
      const user_id = req.user.id;
      if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
        const { referral } = req.body;
        if (!referral) {
            return res.status(400).json({ error: 'referral and user_id are required' });
        }
      const data = await model.revertReferralToken(referral.trim(), user_id);
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
},

  getReferralById: async (req, res) => {
    try {
      const referralId = req.params.referral_id;
      const data = await model.getReferralById(referralId);
      if (!data) return res.status(404).json({ error: 'Referral not found' });
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  getReferrals: async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
      const search = req.query.search ? String(req.query.search) : '';

      const data = await model.getReferrals({ limit, offset, search });
      
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

  deleteReferral: async (req, res) => {
    try {
      const referralId = req.params.referral_id;
      const ok = await model.deleteReferral(referralId);
      if (!ok) return res.status(404).json({ error: 'Referral not found' });
      return res.status(200).json({ message: 'Referral deleted' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  },

};