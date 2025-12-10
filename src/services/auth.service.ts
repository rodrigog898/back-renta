import bcrypt from 'bcryptjs';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
import { signAccess, signRefresh, verify } from '../utils/jwt';
import { sha256 } from '../utils/crypto';
import * as Audit from './audit.service';
import { AppError } from '../utils/AppError';

export async function register(email: string, password: string, auditCtx?: any) {
  const exists = await User.findOne({ email });
  if (exists) {
    throw new AppError('Email already in use', 409);
  }
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });

  try {
    await Audit.log(auditCtx || {}, {
      action: 'user.create',
      entity: 'User',
      entityId: String(user._id),
      before: null,
      after: { id: user._id, email: user.email },
      metadata: null
    });
  } catch {}

  return issueTokens(user._id.toString());
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid credentials', 401);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError('Invalid credentials', 401);
  return issueTokens(user._id.toString());
}

export async function issueTokens(userId: string) {
  const accessToken = signAccess({ sub: userId }, '1h'); 
  const refreshToken = signRefresh({ sub: userId }, '7d');

  const tokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  
  await RefreshToken.findOneAndUpdate(
    { userId }, 
    { tokenHash, expiresAt, revokedAt: null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { accessToken, refreshToken };
}


export async function refresh(refreshTokenRaw: string) {
  const payload = verify(refreshTokenRaw);
  if ((payload as any).typ !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }
  const tokenHash = sha256(refreshTokenRaw);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || !(stored as any).isActive) {
    throw new AppError('Refresh token revoked or expired', 401);
  }
  stored.revokedAt = new Date(); // rotación
  await stored.save();

  return issueTokens(String((payload as any).sub));
}
