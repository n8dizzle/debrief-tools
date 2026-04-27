import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listTechBins, createTechBin } from '@/lib/services/tech-bins';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listTechBins({
      technicianId: sp.get('technician_id'),
      warehouseId: sp.get('warehouse_id'),
      status: sp.get('status'),
    });
    return NextResponse.json({ bins: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager', 'warehouse_staff');
    const b = (await req.json()) as { barcode?: string; bin_label?: string; technician_id?: string; warehouse_id?: string };
    if (!b.barcode || !b.bin_label || !b.technician_id || !b.warehouse_id) {
      throw new AppError('barcode, bin_label, technician_id, warehouse_id required', 400);
    }
    const row = await createTechBin({
      barcode: b.barcode,
      bin_label: b.bin_label,
      technician_id: b.technician_id,
      warehouse_id: b.warehouse_id,
    });
    return NextResponse.json({ bin: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
