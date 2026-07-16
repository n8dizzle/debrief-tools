import { getServerSupabase } from '@/lib/supabase';
import {
  INSTALL_STAGES,
  nodesToStages,
  type InstallNode,
  type Stage,
} from '@/lib/install-stages';

// Load the install map. Reads from install_nodes when Supabase is configured;
// falls back to the hardcoded seed (Rung 1 data) when it is not, so the app
// always renders something.
// Which workflows have a real template (a top-level stage). full_system always does
// (seed fallback); others only once seeded.
export async function getBuiltWorkflows(): Promise<Set<string>> {
  const built = new Set<string>(['full_system']);
  const supabase = getServerSupabase();
  if (!supabase) return built;
  const { data } = await supabase.from('install_nodes').select('workflow').eq('is_archived', false).eq('depth', 0);
  for (const r of ((data as unknown) as { workflow: string }[]) || []) built.add(r.workflow);
  return built;
}

export async function getInstallStages(
  workflow: string = 'full_system',
): Promise<{ stages: Stage[]; source: 'db' | 'seed' }> {
  const supabase = getServerSupabase();
  if (!supabase) return { stages: workflow === 'full_system' ? INSTALL_STAGES : [], source: 'seed' };

  const { data, error } = await supabase
    .from('install_nodes')
    .select('*')
    .eq('is_archived', false)
    .eq('workflow', workflow)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    // full_system falls back to the hardcoded seed; other workflows just come up empty
    // (their tab shows a "not built yet" stub) until they're seeded.
    return { stages: workflow === 'full_system' ? INSTALL_STAGES : [], source: workflow === 'full_system' ? 'seed' : 'db' };
  }
  return { stages: nodesToStages(data as InstallNode[]), source: 'db' };
}
