import { NextRequest, NextResponse } from 'next/server'
import { advanceStageWithToken } from '@/lib/tracker'

// POST /api/contractor/job/[token]/advance - Advance to next stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get optional note from body
    let note: string | undefined
    try {
      const body = await request.json()
      note = body.note
    } catch {
      // No body or invalid JSON is fine
    }

    const result = await advanceStageWithToken(token, note)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to advance stage' },
        { status: 400 }
      )
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[Advance Stage Error]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to advance stage' },
      { status: 500 }
    )
  }
}
