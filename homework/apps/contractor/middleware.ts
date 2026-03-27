import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/login', '/signup', '/auth/callback'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  const isOnboarding = pathname.startsWith('/onboarding');

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const onboardingComplete = user.user_metadata?.onboarding_complete === true;

    // Redirect authenticated users away from auth pages
    if (isPublicPath && pathname !== '/auth/callback') {
      const url = request.nextUrl.clone();
      url.pathname = onboardingComplete ? '/dashboard' : '/onboarding';
      return NextResponse.redirect(url);
    }

    // If onboarding not complete and trying to access dashboard routes, redirect to onboarding
    if (!onboardingComplete && !isOnboarding && !isPublicPath && !pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // If onboarding complete and on /onboarding, redirect to dashboard
    if (onboardingComplete && isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
