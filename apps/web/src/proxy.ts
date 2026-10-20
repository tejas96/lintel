import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'lintel_session';
const PUBLIC_PATHS = ['/sign-in'];

/**
 * Sends visitors without a session cookie to sign-in (keeping where they were
 * going) and tells server components the requested path. The API still
 * decides whether the cookie is valid; this is only the fast first check.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!isPublic && !request.cookies.has(SESSION_COOKIE)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/sign-in';
    signIn.search = '';
    if (pathname !== '/') signIn.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }
  const headers = new Headers(request.headers);
  headers.set('x-lintel-path', `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)',
  ],
};
