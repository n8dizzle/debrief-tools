import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// POST /api/suggestions/[id]/vote - Toggle vote
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const userId = session.user.id;
    const suggestionId = params.id;

    // Check if already voted
    const { data: existingVote } = await supabase
      .from("portal_suggestion_votes")
      .select("id")
      .eq("suggestion_id", suggestionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingVote) {
      // Remove vote
      await supabase
        .from("portal_suggestion_votes")
        .delete()
        .eq("id", existingVote.id);

      // Decrement count
      await supabase.rpc("decrement_suggestion_votes", {
        sid: suggestionId,
      }).then(({ error }) => {
        // Fallback if RPC doesn't exist
        if (error) {
          return supabase
            .from("portal_suggestions")
            .update({ vote_count: 0 })
            .eq("id", suggestionId);
        }
      });

      // Get updated count
      const { data: votes } = await supabase
        .from("portal_suggestion_votes")
        .select("id")
        .eq("suggestion_id", suggestionId);

      await supabase
        .from("portal_suggestions")
        .update({
          vote_count: votes?.length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);

      return NextResponse.json({ voted: false, vote_count: votes?.length || 0 });
    } else {
      // Add vote
      await supabase.from("portal_suggestion_votes").insert({
        suggestion_id: suggestionId,
        user_id: userId,
      });

      // Get updated count
      const { data: votes } = await supabase
        .from("portal_suggestion_votes")
        .select("id")
        .eq("suggestion_id", suggestionId);

      await supabase
        .from("portal_suggestions")
        .update({
          vote_count: votes?.length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);

      return NextResponse.json({ voted: true, vote_count: votes?.length || 0 });
    }
  } catch (error) {
    console.error("Error toggling vote:", error);
    return NextResponse.json({ error: "Failed to toggle vote" }, { status: 500 });
  }
}
