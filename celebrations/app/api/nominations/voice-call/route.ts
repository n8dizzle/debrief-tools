import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_NOMINATIONS_AGENT_ID;

    if (!apiKey || !agentId) {
      return NextResponse.json(
        { error: 'Voice nominations not configured' },
        { status: 500 }
      );
    }

    const res = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Retell API error:', res.status, text);
      return NextResponse.json(
        { error: `Retell error: ${res.status} ${text}` },
        { status: 500 }
      );
    }

    const webCall = await res.json();

    return NextResponse.json({
      access_token: webCall.access_token,
      call_id: webCall.call_id,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Create voice call error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to start voice call' },
      { status: 500 }
    );
  }
}
