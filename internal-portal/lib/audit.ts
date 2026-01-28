import { getServerSupabase } from './supabase';
import type { AuditAction } from '@christmas-air/shared/types';

interface AuditLogParams {
  actorId: string | null;
  action: AuditAction;
  targetType: 'user' | 'permission';
  targetId: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Log an action to the audit trail.
 * Fire and forget - errors are logged but don't throw.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const supabase = getServerSupabase();

    const { error } = await supabase.from('portal_audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      ip_address: params.ipAddress ?? null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

/**
 * Get the client IP address from request headers.
 */
export function getClientIP(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return null;
}
