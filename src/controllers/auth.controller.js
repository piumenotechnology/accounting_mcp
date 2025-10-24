import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { authModels } from '../models/user.models.js'
import { google } from 'googleapis';

import {
  generateToken,
  generateRefreshToken,
} from '../services/userTokenServices.js';

import { tokenModel } from '../models/token.model.js';
import { getTokens, deleteTokens } from '../models/google.model.js';
// import { referralModels } from '../models/referral.models.js';
import { isGoogleStillConnected } from '../services/googleTokenService.js';
import { upsertTokens } from '../models/google.model.js';

dotenv.config();

const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
const audiences = [GOOGLE_WEB_CLIENT_ID].filter(Boolean);

const client = new OAuth2Client(); 

export const auth = {
  googleLogin: async (req, res) => {
    try {
      const { idToken } = req.body;

      if (!idToken) return res.status(400).json({ error: 'ID Token is required' });

      let payload = null;
      for (const aud of audiences) {
        try {
          const ticket = await client.verifyIdToken({ idToken, audience: aud });
          payload = ticket.getPayload();
          break;
        } catch (_) {
          console.log("error tisckets");
        }
      }
      
      if (!payload) {
        console.error('Token verification failed for all audiences:', verifyError?.message);
        return res.status(401).json({ 
          error: "Invalid Google token", 
          details: verifyError?.message 
        });
      }

      const { sub, email, name, picture, email_verified } = payload;
      if (!email || email_verified === false) {
        return res.status(401).json({ error: 'Email not verified' });
      }

      const user = await authModels.userGoogle({
        google_id: sub,
        email,
        name,
        picture
      });
      
      const token = generateToken(user); 
      const refreshToken = generateRefreshToken();
      await tokenModel.createRefreshToken(user.id, refreshToken, 30);
      // const referral = await referralModels.getReferralUsageByUser(user.id)
      // const tableScope = await referralModels.getScope(user.id)
      const cekGoogleConnectedValid = await isGoogleStillConnected(user.id);

      console.log(cekGoogleConnectedValid);
      
      res.json({
        user: { id: user.id, name: user.name, email: user.email, picture: user.picture },
        token,
        refreshToken,
        // referral,
        // scopes: tableScope,
        googleConnected: cekGoogleConnectedValid // true when we attempted to connect
      });

    } catch (error) {
      console.error('Google Auth Error');
      res.status(401).json({ error: 'Invalid Google token' });
    }
  },
  getUser: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await authModels.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({ user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error('Error fetching user:', error.message);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },
  deleteUser: async (req, res) => {
    try {
      const userId = req.user.id;
      const deletedUser = await authModels.deleteUser(userId);
      if (!deletedUser) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error.message);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },
  getAllUsers: async (req, res) => {
    try {
        const users = await authModels.getAllUsers();
        res.json({ users: users.map(u => ({ id: u.id, name: u.name, email: u.email })) });
    } catch (error) {
        console.error('Error fetching all users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
  },
  refresh: async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

      const row = await tokenModel.findRefreshToken(refreshToken);
      if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
      if (row.revoked_at) return res.status(401).json({ error: 'Refresh token revoked' });
      if (new Date(row.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      // rotate
      await tokenModel.revokeRefreshTokenById(row.id);

      const user = await authModels.getUserById(row.user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newAccess = generateToken(user);
      const newRawRefresh = generateRefreshToken();
      await tokenModel.createRefreshToken(user.id, newRawRefresh, 30);

      res.json({ token: newAccess, refreshToken: newRawRefresh });
    } catch (e) {
      console.error('Refresh Error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  },
  cekGoogleConnectedValid: async(req, res) => {
    try {
      const userId = req.query.user_id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const cekGoogleConnectedValid = await isGoogleStillConnected(userId);
      res.json({ googleConnected: cekGoogleConnectedValid });
    } catch (e) {
      console.error('Cek Google Connected Error:', e);
      res.status(500).json({ error: 'Server error' });
    }   
  },
  logoutGoogle: async (req, res) => {
    try {
      const userId = req.user.id;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { refreshToken } = req.body;

      // 1️⃣ Revoke app refresh tokens
      if (refreshToken) {
        await tokenModel.revokeRefreshToken(refreshToken);
        await tokenModel.revokeAllRefreshTokensForUser(userId);
      }

      // 2️⃣ Get Google tokens
      const tokens = await getTokens(userId);

      // 3️⃣ Only revoke if there is an access_token but NOT a refresh_token
      if (tokens && tokens.access_token && !tokens.refresh_token) {
        try {
          const oauth = new google.auth.OAuth2(
            process.env.GOOGLE_WEB_CLIENT_ID,
            process.env.GOOGLE_WEB_CLIENT_SECRET
          );

          oauth.setCredentials({
            access_token: tokens.access_token
          });

          await oauth.revokeCredentials();

          // ✅ Only delete tokens if revoke succeeded
          await deleteTokens(userId);

        } catch (revokeError) {
          console.warn('⚠️ Token revoke warning:', revokeError.message);
        }
      }

      // 4️⃣ Respond success
      res.json({
        success: true,
        message: 'Logged out successfully (Google revoked if applicable)'
      });

    } catch (error) {
      console.error('❌ Complete logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  },
  revokeGoogleTokens: async (req, res) => {
    try {
      const userId = req.body.user_id;
      const tokens = await getTokens(userId);
      if (!tokens || !tokens.access_token) {
        return res.status(400).json({ error: 'No Google tokens found' });
      } 
      try {
        const oauth = new google.auth.OAuth2(
          process.env.GOOGLE_WEB_CLIENT_ID,
          process.env.GOOGLE_WEB_CLIENT_SECRET
        );
        oauth.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        });
        await oauth.revokeCredentials();
      } catch (revokeError) {
        console.warn('Token revoke warning:', revokeError.message);
      } 
      await deleteTokens(userId);
      res.json({ success: true, message: 'Google tokens revoked' });
    } catch (error) {
      console.error('Revoke Google tokens error:', error);
      res.status(500).json({ error: 'Failed to revoke Google tokens' });
    }
  },
  consentUser: async (req, res) => {
    try {
      const CID  = process.env.GOOGLE_WEB_CLIENT_ID;
      const CSEC = process.env.GOOGLE_WEB_CLIENT_SECRET;
      const { authCode } = req.body || {};
      const userId = Number(req.query.user_id);

      if (!CID || !CSEC) return res.status(500).json({ error: "Missing Web client id or secret" });
      if (!authCode) return res.status(400).json({ error: "authCode required" });
      if (!userId)   return res.status(400).json({ error: "user_id required" });

      // const oauth2 = new google.auth.OAuth2(CID, CSEC, "postmessage");
      const oauth2 = new google.auth.OAuth2(CID, CSEC,'');
      
      const { tokens } = await oauth2.getToken(authCode);
      const existing = await getTokens(userId);
      
      await upsertTokens(userId, {
        access_token: tokens.access_token || existing?.access_token || "",
        refresh_token: tokens.refresh_token || existing?.refresh_token || null,
        scope: tokens.scope || existing?.scope || "",
        token_type: tokens.token_type || existing?.token_type || "Bearer",
        expiry_date: tokens.expiry_date || existing?.expiry_date || (Date.now() + 50 * 60 * 1000),
        id_token: tokens.id_token || existing?.id_token || null
      });

      res.json({ ok: true });
    } catch (e) {
      const g = e?.response?.data || {};
      res.status(400).json({ 
        error: g.error || e.message, 
        details: g,
      });
    }
  }
};
