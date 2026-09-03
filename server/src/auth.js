import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run } from './db.js';

const SECRET = process.env.JWT_SECRET || 'trabajo-farmer-dev-secret';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.userId || Date.now() > (payload.exp ?? 0)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function registerUser({ email, password, name = '' }) {
  const mail = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('Email inválido');
  if (!password || String(password).length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  const existing = await get('SELECT id FROM users WHERE email = ?', [mail]);
  if (existing) throw new Error('Ya existe una cuenta con ese email');
  const info = await run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [mail, hashPassword(String(password)), String(name).trim()]
  );
  return { id: Number(info.lastInsertRowid), email: mail, name: String(name).trim() };
}

export async function loginUser({ email, password }) {
  const mail = String(email ?? '').trim().toLowerCase();
  const user = await get('SELECT * FROM users WHERE email = ?', [mail]);
  if (!user || !verifyPassword(String(password ?? ''), user.password_hash)) {
    throw new Error('Email o contraseña incorrectos');
  }
  const token = signToken({ userId: Number(user.id), exp: Date.now() + TOKEN_TTL_MS });
  return { token, user: { id: Number(user.id), email: user.email, name: user.name } };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.userId = Number(payload.userId);
  next();
}