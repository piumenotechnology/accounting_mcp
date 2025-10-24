import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
if (!ACCESS_TOKEN_SECRET) {
  throw new Error('ACCESS_TOKEN_SECRET not set');
}

// Password helpers
export const hashPassword = (password) => bcrypt.hash(password, 10);
export const comparePasswords = (enteredPassword, storedPassword) =>
  bcrypt.compare(enteredPassword, storedPassword);

// Issue short-lived access JWT
export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '60m' }
  );
};

// Opaque refresh string, not a JWT
export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

// Hash any token for DB storage
export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
