import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRetellClient } from "@/lib/retell";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const retell = getRetellClient();
    const agents = await retell.agent.list();

    const simplified = agents.map((a: any) => ({
      agent_id: a.agent_id,
      agent_name: a.agent_name || a.agent_id,
      voice_id: a.voice_id,
      is_published: a.is_published,
    }));

    return NextResponse.json(simplified);
  } catch (err: any) {
    console.error("List agents error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to list agents" },
      { status: err.status || 500 }
    );
  }
}
