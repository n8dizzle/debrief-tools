import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/suggestions/[id] - Get a single suggestion with messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const { data: suggestion, error } = await supabase
      .from("portal_suggestions")
      .select(`
        *,
        portal_users!portal_suggestions_author_id_fkey(id, name, email)
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;

    // Get messages
    const { data: messages } = await supabase
      .from("portal_suggestion_messages")
      .select("*")
      .eq("suggestion_id", params.id)
      .order("created_at", { ascending: true });

    // Check if user has voted
    const { data: vote } = await supabase
      .from("portal_suggestion_votes")
      .select("id")
      .eq("suggestion_id", params.id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    return NextResponse.json({
      ...suggestion,
      author: suggestion.portal_users,
      portal_users: undefined,
      messages: messages || [],
      has_voted: !!vote,
    });
  } catch (error) {
    console.error("Error fetching suggestion:", error);
    return NextResponse.json({ error: "Failed to fetch suggestion" }, { status: 500 });
  }
}

// PATCH /api/suggestions/[id] - Update suggestion (publish, change status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const body = await request.json();

    // Only author or owner can update
    const { data: existing } = await supabase
      .from("portal_suggestions")
      .select("author_id")
      .eq("id", params.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAuthor = existing.author_id === session.user.id;
    const isOwner = session.user.role === "owner";

    if (!isAuthor && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-owners can only publish their own drafts
    if (!isOwner && body.status && body.status !== "published") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.ai_summary !== undefined) updateData.ai_summary = body.ai_summary;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await supabase
      .from("portal_suggestions")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating suggestion:", error);
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
  }
}

// DELETE /api/suggestions/[id] - Delete suggestion
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const { data: existing } = await supabase
      .from("portal_suggestions")
      .select("author_id")
      .eq("id", params.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAuthor = existing.author_id === session.user.id;
    const isOwner = session.user.role === "owner";

    if (!isAuthor && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("portal_suggestions")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return NextResponse.json({ error: "Failed to delete suggestion" }, { status: 500 });
  }
}
