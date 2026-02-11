import { NextRequest } from 'next/server';
import { POST as cronSync } from '@/app/api/cron/sync/route';

// Manual sync trigger - delegates to the cron sync handler
export async function POST(request: NextRequest) {
  return cronSync(request);
}
