import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || '';
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacSha256Base64Url(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function timingSafeEqual(left: string, right: string) {
  let leftBytes: Uint8Array;
  let rightBytes: Uint8Array;

  try {
    leftBytes = base64UrlToBytes(left);
    rightBytes = base64UrlToBytes(right);
  } catch {
    return false;
  }

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
}

async function isValidAdminSession(token: string | undefined) {
  const secret = getAdminSessionSecret();

  if (!token || !secret) {
    return false;
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    return false;
  }

  const [issuedAtValue, nonce, signature] = parts;
  const issuedAt = Number.parseInt(issuedAtValue, 10);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(issuedAt) || !nonce || issuedAt > now || now - issuedAt > ADMIN_SESSION_MAX_AGE_SECONDS) {
    return false;
  }

  const expectedSignature = await hmacSha256Base64Url(`${issuedAtValue}.${nonce}`, secret);
  return timingSafeEqual(signature, expectedSignature);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (pathname.startsWith('/admin') && !isLoginRoute) {
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!(await isValidAdminSession(adminToken))) {
      const loginUrl = new URL('/admin/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
