import { promisify } from 'node:util';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const derive = promisify(scrypt);
export const SESSION_COOKIE = 'penguin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function validUsername(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{3,20}$/.test(value);
}

export function validPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

export async function hashPassword(password, salt = randomBytes(16)) {
  const hash = await derive(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { salt, hash };
}

export async function verifyPassword(password, salt, expected) {
  const actual = await derive(password, salt, expected.length, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function issueSession(db, userId, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  db.createSession(tokenHash(token), userId, now + SESSION_TTL_MS);
  return token;
}

export function sessionCookie(token, secure = false) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure = false) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function parseCookies(header = '') {
  const result = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export function authenticate(db, request, now = Date.now()) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  const user = db.getSession(tokenHash(token), now);
  return user ? { ...user, token } : null;
}
