import jwt from 'jsonwebtoken';

import dotenv from 'dotenv';
dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

export function requireAuth (req, res, next){
  try {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    if (!token) return res.status(401).json({ error: 'No token' });
    req.user = jwt.verify(token, ACCESS_TOKEN_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

