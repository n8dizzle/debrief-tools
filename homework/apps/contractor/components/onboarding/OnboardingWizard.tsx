'use client';

import { useState, useCallback } from 'react';
import ProgressBar from './ProgressBar';
import StepBusinessProfile, { type BusinessProfileData } from './StepBusinessProfile';
import StepBusinessType, { type BusinessTypeData } from './StepBusinessType';
import StepRevenueGoals, { type RevenueGoalsData } from './StepRevenueGoals';
import StepServiceAreas, { type ServiceAreasData } from './StepServiceAreas';
import StepPriceBookGeneration from './StepPriceBookGeneration';
import { DFW_BENCHMARKS } from '@/lib/business-types';

interface OnboardingWizardProps {
  initialStep?: number;
  userEmail?: string;
}

export default function OnboardingWizard({ initialStep = 2, userEmail }: OnboardingWizardProps) {
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);

  // Step 2: Business Profile
  const [profileData, setProfileData] = useState<BusinessProfileData>({
    business_name: '',
    owner_name: '',
    phone: '',
    business_email: userEmail || '',
    website_url: '',
    business_description: '',
    logo_url: '',
    address_line1: '',
    city: '',
    state: 'TX',
    zip_code: '',
    years_in_business: null,
    employee_count: null,
  });

  // Step 3: Business Type
  const [typeData, setTypeData] = useState<BusinessTypeData>({
    business_types: [],
    years_in_business: null,
    employee_count: null,
  });

  // Step 4: Revenue Goals
  const [revenueData, setRevenueData] = useState<RevenueGoalsData>({
    annual_revenue_target: 500000,
    jobs_per_week_target: 10,
    labor_cost_pct: DFW_BENCHMARKS.labor.default,
    materials_cost_pct: DFW_BENCHMARKS.materials.default,
    overhead_pct: DFW_BENCHMARKS.overhead.default,
    profit_margin_pct: DFW_BENCHMARKS.profit.default,
  });

  // Step 5: Service Areas
  const [areasData, setAreasData] = useState<ServiceAreasData>({
    all_dfw: true,
    zip_codes: [],
  });

  // Save step data to server
  const saveStep = useCallback(async (stepNum: number, data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepNum, data }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Save step error:', err);
      }
    } catch (err) {
      console.error('Save step error:', err);
    } finally {
      setSaving(false);
    }
  }, []);

  // Pass enrichment data from profile to type step
  function handleProfileNext() {
    // Carry over years/employees from AI enrichment
    setTypeData((prev) => ({
      ...prev,
      years_in_business: profileData.years_in_business ?? prev.years_in_business,
      employee_count: profileData.employee_count ?? prev.employee_count,
    }));

    saveStep(2, {
      business_name: profileData.business_name,
      owner_name: profileData.owner_name,
      phone: profileData.phone,
      business_email: profileData.business_email,
      website_url: profileData.website_url,
      business_description: profileData.business_description,
      logo_url: profileData.logo_url,
      address_line1: profileData.address_line1,
      city: profileData.city,
      state: profileData.state,
      zip_code: profileData.zip_code,
    });

    setStep(3);
  }

  function handleTypeNext() {
    saveStep(3, {
      business_types: typeData.business_types,
      years_in_business: typeData.years_in_business,
      employee_count: typeData.employee_count,
    });
    setStep(4);
  }

  function handleRevenueNext() {
    saveStep(4, {
      annual_revenue_target: revenueData.annual_revenue_target,
      jobs_per_week_target: revenueData.jobs_per_week_target,
      labor_cost_pct: revenueData.labor_cost_pct,
      materials_cost_pct: revenueData.materials_cost_pct,
      overhead_pct: revenueData.overhead_pct,
      profit_margin_pct: revenueData.profit_margin_pct,
    });
    setStep(5);
  }

  function handleAreasNext() {
    saveStep(5, {
      zip_codes: areasData.zip_codes,
    });
    setStep(6);
  }

  return (
    <div>
      {step < 6 && <ProgressBar currentStep={step} />}

      {saving && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem',
          background: 'var(--bg-card)', padding: '0.5rem 1rem',
          borderRadius: '8px', border: '1px solid var(--border-default)',
          fontSize: '0.75rem', color: 'var(--text-muted)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 50,
        }}>
          Saving...
        </div>
      )}

      {step === 2 && (
        <StepBusinessProfile
          data={profileData}
          onChange={setProfileData}
          onNext={handleProfileNext}
        />
      )}

      {step === 3 && (
        <StepBusinessType
          data={typeData}
          onChange={setTypeData}
          onNext={handleTypeNext}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepRevenueGoals
          data={revenueData}
          onChange={setRevenueData}
          onNext={handleRevenueNext}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && (
        <StepServiceAreas
          data={areasData}
          onChange={setAreasData}
          onNext={handleAreasNext}
          onBack={() => setStep(4)}
        />
      )}

      {step === 6 && (
        <StepPriceBookGeneration
          onBack={() => setStep(5)}
        />
      )}
    </div>
  );
}
