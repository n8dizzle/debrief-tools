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
export async function getInstallStages(): Promise<{ stages: Stage[]; source: 'db' | 'seed' }> {
  const supabase = getServerSupabase();
  if (!supabase) return { stages: INSTALL_STAGES, source: 'seed' };

  const { data, error } = await supabase
    .from('install_nodes')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return { stages: INSTALL_STAGES, source: 'seed' };
  }
  return { stages: nodesToStages(data as InstallNode[]), source: 'db' };
}
