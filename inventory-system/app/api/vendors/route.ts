import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listSupplyHouses, type SupplyHouse } from '@/lib/services/supply-houses';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface VendorShape {
  id: string;
  name: string;
  contact: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  lead_days: number | null;
  account_number: string | null;
  is_active: boolean;
}

function toVendor(row: SupplyHouse): VendorShape {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact_name,
    email: row.contact_email,
    phone: row.contact_phone,
    department: row.department,
    lead_days: row.lead_time_days,
    account_number: row.account_number,
    is_active: row.is_active,
  };
}

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const dept = req.nextUrl.searchParams.get('department');
    const rows = await listSupplyHouses({ department: dept, isActive: true });
    return NextResponse.json({ vendors: rows.map(toVendor) });
  } catch (e) {
    return errorResponse(e);
  }
}
