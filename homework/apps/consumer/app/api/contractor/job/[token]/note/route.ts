import { NextRequest, NextResponse } from 'next/server'
import { addStageNoteWithToken } from '@/lib/tracker'

// POST /api/contractor/job/[token]/note - Add a note to current stage
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

    const body = await request.json()
    const { note } = body

    if (!note || typeof note !== 'string') {
      return NextResponse.json(
        { error: 'Note is required' },
        { status: 400 }
      )
    }

    const result = await addStageNoteWithToken(token, note)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to add note' },
        { status: 400 }
      )
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('[Add Note Error]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add note' },
      { status: 500 }
    )
  }
}
