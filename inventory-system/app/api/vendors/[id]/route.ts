import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getSupplyHouse } from '@/lib/services/supply-houses';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const row = await getSupplyHouse(id);
    return NextResponse.json({
      vendor: {
        id: row.id,
        name: row.name,
        contact: row.contact_name,
        email: row.contact_email,
        phone: row.contact_phone,
        department: row.department,
        lead_days: row.lead_time_days,
        account_number: row.account_number,
        is_active: row.is_active,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
