'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useHRPermissions } from '@/hooks/useHRPermissions';

interface Template {
  id: string;
  name: string;
  description: string | null;
  workflow_type: 'onboarding' | 'offboarding';
  department_id: string | null;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  phase_count: number;
  step_count: number;
  portal_departments?: { id: string; name: string; slug: string } | null;
}

export default function TemplatesPage() {
  const { canManageTemplates } = useHRPermissions();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      setTemplates(await res.json());
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSeedMsg('Base template seeded successfully!');
        await loadTemplates();
      } else {
        setSeedMsg(data.error || 'Failed to seed template');
      }
    } catch (err) {
      setSeedMsg('Error seeding template');
    } finally {
      setSeeding(false);
    }
  };

  const hasBaseTemplate = templates.some((t) => t.is_base);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => { setLoading(true); setError(null); loadTemplates(); }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Workflow Templates
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage onboarding and offboarding workflow templates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hasBaseTemplate && canManageTemplates && (
            <button
              className="btn btn-primary"
              onClick={handleSeed}
              disabled={seeding}
            >
              {seeding ? 'Seeding...' : 'Seed Base Template'}
            </button>
          )}
        </div>
      </div>

      {seedMsg && (
        <div
          className="card mb-4 text-sm"
          style={{
            backgroundColor: seedMsg.includes('success') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: seedMsg.includes('success') ? '#4ade80' : '#f87171',
          }}
        >
          {seedMsg}
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>No templates yet. Seed a base template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Link key={template.id} href={`/templates/${template.id}`} className="block">
              <div
                className="card transition-all duration-200 hover:border-[var(--christmas-green-dark)]"
                style={{ cursor: 'pointer' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-base" style={{ color: 'var(--christmas-cream)' }}>
                    {template.name}
                  </h3>
                  <span
                    className="badge text-xs"
                    style={{
                      backgroundColor: template.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                      color: template.is_active ? '#4ade80' : '#9ca3af',
                    }}
                  >
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {template.description && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {template.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Workflow type badge */}
                  <span
                    className="badge text-xs"
                    style={{
                      backgroundColor: template.workflow_type === 'onboarding'
                        ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: template.workflow_type === 'onboarding' ? '#60a5fa' : '#c084fc',
                    }}
                  >
                    {template.workflow_type === 'onboarding' ? 'Onboarding' : 'Offboarding'}
                  </span>

                  {/* Department badge */}
                  {template.portal_departments && (
                    <span
                      className="badge text-xs"
                      style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}
                    >
                      {template.portal_departments.name}
                    </span>
                  )}

                  {/* Base template badge */}
                  {template.is_base && (
                    <span
                      className="badge text-xs"
                      style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}
                    >
                      Base Template
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{template.phase_count} phase{template.phase_count !== 1 ? 's' : ''}</span>
                  <span>{template.step_count} step{template.step_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
