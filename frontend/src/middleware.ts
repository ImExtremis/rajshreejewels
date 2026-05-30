import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  // NextAuth v5 session cookie names (both dev and secure production cookies)
  const sessionToken = 
    cookies.get('authjs.session-token')?.value || 
    cookies.get('__Secure-authjs.session-token')?.value ||
    cookies.get('next-auth.session-token')?.value ||
    cookies.get('__Secure-next-auth.session-token')?.value;

  const isProtectedRoute = nextUrl.pathname.startsWith('/account') || nextUrl.pathname.startsWith('/checkout');

  if (isProtectedRoute && !sessionToken) {
    const redirectUrl = new URL('/auth/login', nextUrl.origin);
    redirectUrl.searchParams.set('redirect', nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

// Route matchers to protect account pages and checkout pages
export const config = {
  matcher: ['/account/:path*', '/checkout/:path*'],
};
