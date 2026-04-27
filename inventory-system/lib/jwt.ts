import 'server-only';
import jwt, { type SignOptions } from 'jsonwebtoken';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}

const SECRET: string = process.env.JWT_SECRET;
const REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

export interface JwtPayload {
  sub: string; // user id
  iat?: number;
  exp?: number;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
