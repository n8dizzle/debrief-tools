import { NextResponse } from 'next/server';
import { BUSINESS_TYPES } from '@/lib/business-types';

// GET /api/onboarding/business-types — return available business types
export async function GET() {
  return NextResponse.json({ businessTypes: BUSINESS_TYPES });
}
