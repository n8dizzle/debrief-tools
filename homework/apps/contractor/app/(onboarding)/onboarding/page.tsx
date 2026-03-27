import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if onboarding already complete
  if (user.user_metadata?.onboarding_complete) {
    redirect('/dashboard');
  }

  // Check if contractor record exists and get current step
  const { data: contractor } = await supabase
    .from('contractors')
    .select('onboarding_step, onboarding_completed_at')
    .eq('user_id', user.id)
    .single();

  if (contractor?.onboarding_completed_at) {
    redirect('/dashboard');
  }

  // Resume at the step after the last completed one, or start at step 2
  const initialStep = contractor?.onboarding_step ? contractor.onboarding_step + 1 : 2;
  // Clamp to valid range
  const step = Math.min(Math.max(initialStep, 2), 6);

  return <OnboardingWizard initialStep={step} userEmail={user.email} />;
}
