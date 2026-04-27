import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { addLine, type AddLineInput } from '@/lib/services/restock-batches';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const body = (await req.json()) as Partial<AddLineInput>;
    if (!body.material_id || !body.quantity_requested || !body.st_job_id) {
      throw new AppError('material_id, quantity_requested, st_job_id are required', 400);
    }
    const line = await addLine(id, body as AddLineInput);
    return NextResponse.json({ line }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
