import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtAccessPayload, JwtRefreshPayload } from '../types';

type SpecialTokenType = 'magic' | 'reset' | 'invite';

export function signWorkerInviteToken(userId: string): string {
  return jwt.sign({ userId, type: 'magic' }, env.JWT_ACCESS_SECRET, { expiresIn: '72h' });
}

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function signSpecialToken(userId: string, type: SpecialTokenType): string {
  const expiresIn =
    type === 'magic'
      ? env.JWT_MAGIC_EXPIRES
      : type === 'invite'
      ? env.JWT_INVITE_EXPIRES
      : env.JWT_RESET_EXPIRES;

  return jwt.sign({ userId, type }, env.JWT_ACCESS_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}

export function verifySpecialToken(token: string): { userId: string; type: SpecialTokenType } {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; type: SpecialTokenType };
}
