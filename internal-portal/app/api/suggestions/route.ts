import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/suggestions - List all published suggestions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const userId = session.user.id;

    // Get all non-draft suggestions (plus user's own drafts)
    const { data: suggestions, error } = await supabase
      .from("portal_suggestions")
      .select(`
        *,
        portal_users!portal_suggestions_author_id_fkey(id, name, email)
      `)
      .or(`status.neq.draft,author_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get current user's votes
    const { data: votes } = await supabase
      .from("portal_suggestion_votes")
      .select("suggestion_id")
      .eq("user_id", userId);

    const votedIds = new Set((votes || []).map((v: any) => v.suggestion_id));

    const transformed = (suggestions || []).map((s: any) => ({
      ...s,
      author: s.portal_users,
      portal_users: undefined,
      has_voted: votedIds.has(s.id),
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}

// POST /api/suggestions - Create a new draft suggestion (starts chat)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const { data: suggestion, error } = await supabase
      .from("portal_suggestions")
      .insert({
        author_id: session.user.id,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error("Error creating suggestion:", error);
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
  }
}
