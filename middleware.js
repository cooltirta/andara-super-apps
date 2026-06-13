import { NextResponse } from 'next/server';

export function middleware(request) {
  const emailCookie = request.cookies.get('user_email');
  const path = request.nextUrl.pathname;

  // Protect /dashboard routes
  if (path.startsWith('/dashboard') && !emailCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect from /login to /dashboard if logged in
  if (path === '/login' && emailCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect from root / to /dashboard (or /login if not logged in)
  if (path === '/') {
    if (emailCookie) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};
