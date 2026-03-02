import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET - Fetch notification phones and emails
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const [phonesRes, emailsRes, mgrPhonesRes, mgrEmailsRes, hvacMgrPhonesRes, hvacMgrEmailsRes, plumbMgrPhonesRes, plumbMgrEmailsRes, togglesRes, templatesRes, smsLogRes] = await Promise.all([
    supabase.from('ap_sync_settings').select('value').eq('key', 'notification_phones').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'notification_emails').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'install_manager_phones').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'install_manager_emails').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'hvac_manager_phones').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'hvac_manager_emails').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'plumbing_manager_phones').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'plumbing_manager_emails').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'notification_toggles').single(),
    supabase.from('ap_sync_settings').select('value').eq('key', 'notification_templates').single(),
    supabase.from('ap_sms_log').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    notification_phones: phonesRes.data?.value || [],
    notification_emails: emailsRes.data?.value || [],
    install_manager_phones: mgrPhonesRes.data?.value || [],
    install_manager_emails: mgrEmailsRes.data?.value || [],
    hvac_manager_phones: hvacMgrPhonesRes.data?.value || [],
    hvac_manager_emails: hvacMgrEmailsRes.data?.value || [],
    plumbing_manager_phones: plumbMgrPhonesRes.data?.value || [],
    plumbing_manager_emails: plumbMgrEmailsRes.data?.value || [],
    notification_toggles: togglesRes.data?.value || {},
    notification_templates: templatesRes.data?.value || {},
    sms_log: smsLogRes.data || [],
  });
}

// PATCH - Update notification phones and/or emails
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { notification_phones, notification_emails, install_manager_phones, install_manager_emails, hvac_manager_phones, hvac_manager_emails, plumbing_manager_phones, plumbing_manager_emails, notification_toggles, notification_templates } = body;

  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  // Helper to validate and upsert a phone array
  async function upsertPhones(key: string, phones: unknown) {
    if (phones === undefined) return null;
    if (!Array.isArray(phones)) {
      return { error: `${key} must be an array` };
    }
    for (const entry of phones) {
      if (!entry.name || !entry.phone) {
        return { error: `Each ${key} entry must have name and phone` };
      }
    }
    const { error } = await supabase
      .from('ap_sync_settings')
      .upsert({ key, value: phones, updated_at: now }, { onConflict: 'key' });
    if (error) return { error: error.message };
    return null;
  }

  // Helper to validate and upsert an email array
  async function upsertEmails(key: string, emails: unknown) {
    if (emails === undefined) return null;
    if (!Array.isArray(emails)) {
      return { error: `${key} must be an array` };
    }
    for (const entry of emails) {
      if (!entry.name || !entry.email) {
        return { error: `Each ${key} entry must have name and email` };
      }
    }
    const { error } = await supabase
      .from('ap_sync_settings')
      .upsert({ key, value: emails, updated_at: now }, { onConflict: 'key' });
    if (error) return { error: error.message };
    return null;
  }

  // Upsert notification toggles (simple object, no validation needed beyond type check)
  async function upsertToggles(toggles: unknown) {
    if (toggles === undefined) return null;
    if (typeof toggles !== 'object' || toggles === null) {
      return { error: 'notification_toggles must be an object' };
    }
    const { error } = await supabase
      .from('ap_sync_settings')
      .upsert({ key: 'notification_toggles', value: toggles, updated_at: now }, { onConflict: 'key' });
    if (error) return { error: error.message };
    return null;
  }

  // Upsert notification templates (object with string values)
  async function upsertTemplates(templates: unknown) {
    if (templates === undefined) return null;
    if (typeof templates !== 'object' || templates === null) {
      return { error: 'notification_templates must be an object' };
    }
    for (const [, val] of Object.entries(templates as Record<string, unknown>)) {
      if (typeof val !== 'string') {
        return { error: 'Each notification_templates value must be a string' };
      }
    }
    const { error } = await supabase
      .from('ap_sync_settings')
      .upsert({ key: 'notification_templates', value: templates, updated_at: now }, { onConflict: 'key' });
    if (error) return { error: error.message };
    return null;
  }

  const results = await Promise.all([
    upsertPhones('notification_phones', notification_phones),
    upsertEmails('notification_emails', notification_emails),
    upsertPhones('install_manager_phones', install_manager_phones),
    upsertEmails('install_manager_emails', install_manager_emails),
    upsertPhones('hvac_manager_phones', hvac_manager_phones),
    upsertEmails('hvac_manager_emails', hvac_manager_emails),
    upsertPhones('plumbing_manager_phones', plumbing_manager_phones),
    upsertEmails('plumbing_manager_emails', plumbing_manager_emails),
    upsertToggles(notification_toggles),
    upsertTemplates(notification_templates),
  ]);

  const firstError = results.find(r => r?.error);
  if (firstError) {
    return NextResponse.json({ error: firstError.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
