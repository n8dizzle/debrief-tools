import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH /api/me/preferences  { theme: 'light' | 'dark' }
// Saves the current user's theme to portal_users.preferences (source of truth) AND sets a
// ca_theme cookie on .christmasair.com — the fast, cross-app transport every app can read.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const theme = body.theme;
  if (theme !== "light" && theme !== "dark") {
    return NextResponse.json({ error: "theme must be 'light' or 'dark'" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: cur } = await supabase.from("portal_users").select("preferences").eq("id", user.id).single();
  const prefs = { ...((cur?.preferences as Record<string, unknown>) || {}), theme };
  const { error } = await supabase.from("portal_users").update({ preferences: prefs }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true, theme });
  res.cookies.set("ca_theme", theme, {
    domain: ".christmasair.com",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
