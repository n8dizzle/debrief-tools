import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Notification Helpers
// ---------------------------------------------------------------------------

export interface CreateNotificationParams {
  userId: string;
  type: string;
  channel?: string;
  title: string;
  body: string;
  actionUrl?: string;
  referenceId?: string;
  referenceType?: string;
}

/**
 * Insert a single notification into the notifications table.
 * Returns the created row, or null on failure.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams
) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      channel: params.channel || 'in_app',
      title: params.title,
      body: params.body,
      action_url: params.actionUrl || null,
      reference_id: params.referenceId || null,
      reference_type: params.referenceType || null,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
  return data;
}

/**
 * Insert multiple notifications in a single batch.
 * Returns the created rows, or an empty array on failure.
 */
export async function createBulkNotifications(
  supabase: SupabaseClient,
  notifications: CreateNotificationParams[]
) {
  const rows = notifications.map((n) => ({
    user_id: n.userId,
    type: n.type,
    channel: n.channel || 'in_app',
    title: n.title,
    body: n.body,
    action_url: n.actionUrl || null,
    reference_id: n.referenceId || null,
    reference_type: n.referenceType || null,
    sent_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select();

  if (error) {
    console.error('Failed to create notifications:', error);
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Activity Log Helpers
// ---------------------------------------------------------------------------

export interface LogActivityParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Insert an entry into the activity_log table.
 * Errors are logged but not thrown (fire-and-forget).
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
) {
  const { error } = await supabase.from('activity_log').insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    changes: params.changes || null,
    metadata: params.metadata || null,
  });

  if (error) {
    console.error('Failed to log activity:', error);
  }
}
