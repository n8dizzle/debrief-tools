import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { checkoutTool, type CheckoutInput } from '@/lib/services/tools';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    const { id } = await params;
    const body = (await req.json()) as Partial<CheckoutInput>;
    if (!body.technician_id) throw new AppError('technician_id is required', 400);
    const tool = await checkoutTool(id, body as CheckoutInput, user.id);
    return NextResponse.json({ tool });
  } catch (e) {
    return errorResponse(e);
  }
}
