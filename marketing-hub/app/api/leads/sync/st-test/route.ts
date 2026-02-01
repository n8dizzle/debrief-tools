import { NextResponse } from 'next/server';

// Simple test endpoint to debug ST API connection
export async function GET() {
  const config = {
    clientId: (process.env.ST_CLIENT_ID || '').trim(),
    clientSecret: (process.env.ST_CLIENT_SECRET || '').trim(),
    tenantId: (process.env.ST_TENANT_ID || '').trim(),
    appKey: (process.env.ST_APP_KEY || '').trim(),
  };

  const hasConfig = !!(config.clientId && config.clientSecret && config.tenantId && config.appKey);

  if (!hasConfig) {
    return NextResponse.json({
      error: 'Missing config',
      debug: {
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasTenantId: !!config.tenantId,
        hasAppKey: !!config.appKey,
        clientIdLen: config.clientId.length,
        tenantId: config.tenantId,
      }
    });
  }

  // Try to get token
  try {
    const tokenRes = await fetch('https://auth.servicetitan.io/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      return NextResponse.json({
        error: 'Token request failed',
        status: tokenRes.status,
        body: errorText.slice(0, 500),
      });
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // Try to fetch 1 page of calls
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const startDate = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

    const callsRes = await fetch(
      `https://api.servicetitan.io/telecom/v2/tenant/${config.tenantId}/calls?receivedOnOrAfter=${startDate}T00:00:00&pageSize=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (!callsRes.ok) {
      const errorText = await callsRes.text();
      return NextResponse.json({
        error: 'Calls request failed',
        status: callsRes.status,
        body: errorText.slice(0, 500),
      });
    }

    const callsData = await callsRes.json();

    return NextResponse.json({
      success: true,
      tokenOk: true,
      startDate,
      totalCount: callsData.totalCount,
      hasMore: callsData.hasMore,
      callsReturned: callsData.data?.length || 0,
      firstCall: callsData.data?.[0] ? {
        id: callsData.data[0].id,
        receivedOn: callsData.data[0].receivedOn,
        direction: callsData.data[0].direction,
      } : null,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: 'Exception',
      message: err.message,
    });
  }
}
