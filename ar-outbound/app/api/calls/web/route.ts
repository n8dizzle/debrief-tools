import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRetellClient } from "@/lib/retell";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { retell_llm_dynamic_variables, metadata } = body;
    const agent_id = body.agent_id || process.env.RETELL_AGENT_ID;

    if (!agent_id) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    const retell = getRetellClient();
    const webCall = await retell.call.createWebCall({
      agent_id,
      retell_llm_dynamic_variables,
      metadata: {
        ...metadata,
        initiated_by: session.user.email,
        source: "ar-outbound",
      },
    });

    // Log to database
    const supabase = getServerSupabase();
    await supabase.from("retell_calls").insert({
      call_id: webCall.call_id,
      call_type: "web_call",
      agent_id: webCall.agent_id,
      direction: "inbound",
      status: webCall.call_status || "registered",
      initiated_by: session.user.email,
      metadata: metadata || null,
    });

    return NextResponse.json({
      call_id: webCall.call_id,
      access_token: webCall.access_token,
      agent_id: webCall.agent_id,
      call_status: webCall.call_status,
    }, { status: 201 });
  } catch (err: any) {
    console.error("Create web call error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create web call" },
      { status: err.status || 500 }
    );
  }
}
