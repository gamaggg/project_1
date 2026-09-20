import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same mechanics, new name/export).
// This just keeps the Supabase auth cookie fresh on every request — it does not
// gate any routes. The map/territories/activity are public (see DECISIONS.md);
// write actions (confirm_catch RPC, profile update) check the session themselves.
export async function proxy(request: NextRequest) {
  // Buffered rather than written straight through inside `setAll` (the usual
  // pattern) — see below for why the write only happens on a
  // confirmed-successful getUser().
  let cookiesToApply: { name: string; value: string; options: CookieOptions }[] | null = null

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToApply = cookiesToSet
        },
      },
    }
  )

  // Touches the session so `getUser()` can refresh an expired access token.
  // The browser's own Supabase client independently auto-refreshes too (on
  // its own timer, and on tab/WebView visibility change) — since refresh
  // tokens are single-use, this proxy's refresh attempt can lose a race
  // against the browser's and get back "Refresh Token Not Found" for a
  // token the browser had *already* rotated moments earlier. Confirmed live
  // in the Auth logs (refresh_token_not_found, referer catchrange.com) —
  // this was the actual cause of users getting randomly signed out on both
  // web and the Telegram Mini App: this proxy used to write the (failed)
  // refresh's cookies straight to the response regardless, which told the
  // browser to drop a session it actually still had. Only apply this
  // proxy's cookie writes when getUser() actually succeeded; a failure here
  // (race or otherwise) is left alone rather than propagated as a sign-out.
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user || !cookiesToApply) {
    return NextResponse.next({ request })
  }
  // TS can't track the reassignment inside the `setAll` closure across the
  // `await` above, and narrows the post-guard type to `never` — cast past it.
  const cookies = cookiesToApply as { name: string; value: string; options: CookieOptions }[]

  for (const { name, value } of cookies) {
    request.cookies.set(name, value)
  }
  const response = NextResponse.next({ request })
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options)
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|data/).*)',
  ],
}
