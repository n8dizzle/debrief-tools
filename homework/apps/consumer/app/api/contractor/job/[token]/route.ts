import { NextRequest, NextResponse } from 'next/server'
import { getJobForContractor } from '@/lib/tracker'

// GET /api/contractor/job/[token] - Get job details for contractor
export async function GET(
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

    const job = await getJobForContractor(token)

    if (!job) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: job })
  } catch (error) {
    console.error('[Get Job Error]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job' },
      { status: 500 }
    )
  }
}
