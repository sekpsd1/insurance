import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
type AdminRole = 'admin' | 'sales';

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

function getSalesAllowedPath(pathname: string) {
  if (pathname === '/admin') {
    return true;
  }

  if (pathname === '/admin/orders/export') {
    return true;
  }

  return pathname.startsWith('/admin/orders/') && !pathname.includes('/email-preview');
}

async function getAdminSessionRole(token: string | undefined): Promise<AdminRole | null> {
  const secret = getAdminSessionSecret();

  if (!token || !secret) {
    return null;
  }

  const parts = token.split('.');
  let role: AdminRole;
  let issuedAtValue: string;
  let nonce: string;
  let signature: string;
  let payload: string;

  if (parts.length === 3) {
    [issuedAtValue, nonce, signature] = parts;
    role = 'admin';
    payload = `${issuedAtValue}.${nonce}`;
  } else if (parts.length === 4) {
    const roleValue = parts[0];
    if (roleValue !== 'admin' && roleValue !== 'sales') {
      return null;
    }

    role = roleValue;
    [, issuedAtValue, nonce, signature] = parts;
    payload = `${role}.${issuedAtValue}.${nonce}`;
  } else {
    return null;
  }

  const issuedAt = Number.parseInt(issuedAtValue, 10);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(issuedAt) || !nonce || issuedAt > now || now - issuedAt > ADMIN_SESSION_MAX_AGE_SECONDS) {
    return null;
  }

  const expectedSignature = await hmacSha256Base64Url(payload, secret);
  return timingSafeEqual(signature, expectedSignature) ? role : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  const isLogoutRoute = pathname === '/admin/logout' || pathname.startsWith('/admin/logout/');

  if (pathname.startsWith('/admin') && !isLoginRoute && !isLogoutRoute) {
    const adminToken = request.cookies.get('admin_token')?.value;
    const role = await getAdminSessionRole(adminToken);

    if (!role) {
      const loginUrl = new URL('/admin/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_token');
      response.cookies.delete('admin_role');
      return response;
    }

    if (role === 'sales' && !getSalesAllowedPath(pathname)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
