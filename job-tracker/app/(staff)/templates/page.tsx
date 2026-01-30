import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, TrackerTemplate, TrackerTemplateMilestone } from '@/lib/supabase';

async function getTemplates(): Promise<(TrackerTemplate & { milestones: TrackerTemplateMilestone[] })[]> {
  const supabase = getServerSupabase();

  const { data } = await supabase
    .from('tracker_templates')
    .select(`
      *,
      milestones:tracker_template_milestones(*)
    `)
    .order('trade')
    .order('job_type')
    .order('name');

  return data || [];
}

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const templates = await getTemplates();

  // Group by trade
  const hvacTemplates = templates.filter((t) => t.trade === 'hvac');
  const plumbingTemplates = templates.filter((t) => t.trade === 'plumbing');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Templates</h1>
          <p className="text-text-secondary mt-1">Manage milestone templates</p>
        </div>
        <Link href="/templates/new" className="btn btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      </div>

      {/* HVAC Templates */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-christmas-green" />
          HVAC Templates
        </h2>
        {hvacTemplates.length === 0 ? (
          <p className="text-text-muted">No HVAC templates</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hvacTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>

      {/* Plumbing Templates */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-christmas-gold" />
          Plumbing Templates
        </h2>
        {plumbingTemplates.length === 0 ? (
          <p className="text-text-muted">No plumbing templates</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plumbingTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: TrackerTemplate & { milestones: TrackerTemplateMilestone[] } }) {
  const sortedMilestones = [...(template.milestones || [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-text-primary">{template.name}</h3>
          <p className="text-sm text-text-muted capitalize">{template.job_type}</p>
        </div>
        <div className="flex items-center gap-2">
          {template.is_default && (
            <span className="badge badge-hvac text-xs">Default</span>
          )}
          {!template.is_active && (
            <span className="badge badge-pending text-xs">Inactive</span>
          )}
        </div>
      </div>

      {template.description && (
        <p className="text-sm text-text-secondary mb-3">{template.description}</p>
      )}

      <div className="border-t border-border-subtle pt-3">
        <p className="text-xs text-text-muted mb-2">{sortedMilestones.length} milestones</p>
        <div className="space-y-1">
          {sortedMilestones.slice(0, 3).map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
              {m.name}
            </div>
          ))}
          {sortedMilestones.length > 3 && (
            <p className="text-xs text-text-muted">+{sortedMilestones.length - 3} more</p>
          )}
        </div>
      </div>
    </div>
  );
}
