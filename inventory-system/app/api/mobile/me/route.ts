/**
 * GET /api/mobile/me
 * Returns the current authenticated user's profile.
 * Mobile app calls this on startup to validate stored token + refresh user data.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { errorResponse } from '@/lib/errors';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);

    // Also load assigned truck info if present
    let truck = null;
    if (user.assigned_truck_id) {
      const { rows } = await query<{ id: string; truck_number: string; department: string }>(
        `SELECT id, truck_number, department FROM trucks WHERE id = $1`,
        [user.assigned_truck_id],
      );
      truck = rows[0] ?? null;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department: user.department,
        homeWarehouseId: user.home_warehouse_id,
        assignedTruckId: user.assigned_truck_id,
        truck,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
