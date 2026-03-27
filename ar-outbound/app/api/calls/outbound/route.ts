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
    const from_number = body.from_number || process.env.RETELL_FROM_NUMBER;
    const to_number = body.to_number;

    if (!to_number) {
      return NextResponse.json({ error: "to_number is required" }, { status: 400 });
    }
    if (!from_number) {
      return NextResponse.json({ error: "from_number is required (set RETELL_FROM_NUMBER env var or pass in request)" }, { status: 400 });
    }

    const retell = getRetellClient();
    const phoneCall = await retell.call.createPhoneCall({
      from_number,
      to_number,
      override_agent_id: agent_id || undefined,
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
      call_id: phoneCall.call_id,
      call_type: "phone_call",
      agent_id: phoneCall.agent_id,
      direction: "outbound",
      from_number: phoneCall.from_number,
      to_number: phoneCall.to_number,
      status: phoneCall.call_status || "registered",
      initiated_by: session.user.email,
      metadata: metadata || null,
    });

    return NextResponse.json({
      call_id: phoneCall.call_id,
      agent_id: phoneCall.agent_id,
      from_number: phoneCall.from_number,
      to_number: phoneCall.to_number,
      call_status: phoneCall.call_status,
    }, { status: 201 });
  } catch (err: any) {
    console.error("Create outbound call error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create outbound call" },
      { status: err.status || 500 }
    );
  }
}
