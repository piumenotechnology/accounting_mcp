import express from 'express';
const router = express.Router();

import {requireAuth} from '../middlewares/auth.js';
import { auth } from '../controllers/auth.controller.js';

router.post("/login", auth.googleLogin);
router.post("/refresh", requireAuth, auth.refresh);
router.post("/logout", requireAuth, auth.logoutGoogle);
router.post("/mobile-exchange", auth.consentUser)

// const scopes = [
//   "https://www.googleapis.com/auth/userinfo.email",
//   "https://www.googleapis.com/auth/userinfo.profile",
//   "https://www.googleapis.com/auth/calendar.events",
//   "https://www.googleapis.com/auth/calendar.readonly", 
//   "https://www.googleapis.com/auth/gmail.send",
//   'https://www.googleapis.com/auth/gmail.readonly',
//   "https://www.googleapis.com/auth/contacts.readonly",
//   "openid",
// ];


// import { google } from "googleapis";
// import { getTokens, upsertTokens } from "../models/google.model.js";

// const CALLBACK_PATH = "/api/v2/auth/callback";
// const oauth2Client = new google.auth.OAuth2(
//   process.env.GOOGLE_WEB_CLIENT_ID,
//   process.env.GOOGLE_WEB_CLIENT_SECRET,
//   `${process.env.BASE_URL}${CALLBACK_PATH}`
// );

// router.get("/connect", (req, res) => {
//   const { user_id } = req.query;
//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     prompt: "consent",
//     scope: scopes,
//     state: String(user_id)
//   });
//   res.redirect(url);
// });

// router.get("/callback", async (req, res) => {
//   try {
//     const { code, state } = req.query;
//     const userId = Number(state); 

//     const { tokens } = await oauth2Client.getToken(code);

//     const existing = await getTokens(userId);
//     await upsertTokens(userId, {
//       access_token: tokens.access_token || existing?.access_token || "",
//       refresh_token: tokens.refresh_token || existing?.refresh_token || null,
//       scope: tokens.scope || existing?.scope || "",
//       token_type: tokens.token_type || existing?.token_type || "Bearer",
//       expiry_date: tokens.expiry_date || existing?.expiry_date || (Date.now() + 50 * 60 * 1000),
//       id_token: tokens.id_token || existing?.id_token || null
//     });
//     res.send("Google connected. You can close this tab.");
//   } catch (e) {
//     console.error("[google/callback] error", e);
//     res.status(400).send("Google connect failed, try again.");
//   }
// });

router.post("/revoke-google-tokens", auth.revokeGoogleTokens);

export default router;

