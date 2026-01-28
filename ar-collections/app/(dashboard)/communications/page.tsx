'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/ar-utils';
import { AREmailTemplate, ARSMSTemplate, AREmailSent, ARSMSSent } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

export default function CommunicationsPage() {
  const [emailTemplates, setEmailTemplates] = useState<AREmailTemplate[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<ARSMSTemplate[]>([]);
  const [recentEmails, setRecentEmails] = useState<AREmailSent[]>([]);
  const [recentSms, setRecentSms] = useState<ARSMSSent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'history'>('templates');
  const { canManageTemplates, canSendCommunications } = useARPermissions();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [templatesRes, historyRes] = await Promise.all([
        fetch('/api/communications/templates', { credentials: 'include' }),
        fetch('/api/communications/history', { credentials: 'include' }),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setEmailTemplates(data.email_templates || []);
        setSmsTemplates(data.sms_templates || []);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setRecentEmails(data.emails || []);
        setRecentSms(data.sms || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Communications
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Email and SMS templates and send history
          </p>
        </div>
        {canManageTemplates && (
          <Link href="/communications/templates" className="btn btn-primary">
            Manage Templates
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('templates')}
            className="px-6 py-3 text-sm font-medium transition-colors"
            style={{
              color: activeTab === 'templates' ? 'var(--christmas-green-light)' : 'var(--text-muted)',
              borderBottom: activeTab === 'templates' ? '2px solid var(--christmas-green)' : '2px solid transparent',
            }}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className="px-6 py-3 text-sm font-medium transition-colors"
            style={{
              color: activeTab === 'history' ? 'var(--christmas-green-light)' : 'var(--text-muted)',
              borderBottom: activeTab === 'history' ? '2px solid var(--christmas-green)' : '2px solid transparent',
            }}
          >
            Send History
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'templates' && (
            <div className="space-y-8">
              {/* Email Templates */}
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                  Email Templates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emailTemplates.length === 0 ? (
                    <div className="col-span-2 text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No email templates configured
                    </div>
                  ) : (
                    emailTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {template.name}
                          </h4>
                          <span className={`badge badge-${template.is_active ? 'current' : '90'}`}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                          Subject: {template.subject}
                        </p>
                        <div className="flex gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span className="capitalize">{template.template_type}</span>
                          {template.days_overdue_trigger && (
                            <span>· Trigger: {template.days_overdue_trigger} days</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SMS Templates */}
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                  SMS Templates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {smsTemplates.length === 0 ? (
                    <div className="col-span-2 text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No SMS templates configured
                    </div>
                  ) : (
                    smsTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {template.name}
                          </h4>
                          <span className={`badge badge-${template.is_active ? 'current' : '90'}`}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                          {template.body.substring(0, 100)}...
                        </p>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span className="capitalize">{template.template_type}</span>
                          <span> · {template.body.length}/160 chars</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8">
              {/* Recent Emails */}
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                  Recent Emails
                </h3>
                <div className="space-y-2">
                  {recentEmails.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No emails sent yet
                    </div>
                  ) : (
                    recentEmails.map((email) => (
                      <div
                        key={email.id}
                        className="flex justify-between items-center p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div>
                          <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {email.subject}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            To: {email.recipient_email}
                          </div>
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(email.sent_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent SMS */}
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                  Recent SMS
                </h3>
                <div className="space-y-2">
                  {recentSms.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No SMS sent yet
                    </div>
                  ) : (
                    recentSms.map((sms) => (
                      <div
                        key={sms.id}
                        className="flex justify-between items-center p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div>
                          <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {sms.message.substring(0, 50)}...
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            To: {sms.recipient_phone}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm ${sms.status === 'delivered' ? 'text-green-500' : sms.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {sms.status}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {formatDate(sms.sent_at)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
