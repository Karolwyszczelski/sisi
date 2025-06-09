import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './types/supabase'; // jeśli nie masz typów, możesz pominąć <Database>

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role;
  const url = req.nextUrl.clone();

  if (url.pathname.startsWith('/admin')) {
    if (role === 'client') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    if (url.pathname === '/admin') {
      if (role === 'admin') {
        url.pathname = '/admin/AdminPanel';
        return NextResponse.redirect(url);
      } else if (role === 'employee') {
        url.pathname = '/admin/EmployeePanel';
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'], // middleware działa dla wszystkich podstron admina
};
