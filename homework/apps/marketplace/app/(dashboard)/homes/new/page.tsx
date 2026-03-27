'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC',
];

const STEPS = ['Address', 'Property Details', 'Home Features'];

interface AddressData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip_code: string;
}

interface PropertyData {
  sqft: string;
  year_built: string;
  bedrooms: string;
  bathrooms: string;
  lot_sqft: string;
  stories: string;
}

interface FeaturesData {
  has_pool: boolean;
  has_sprinkler_system: boolean;
  has_central_hvac: boolean;
  has_furnace: boolean;
  has_fireplace: boolean;
  has_gas_line: boolean;
  has_septic: boolean;
  has_well_water: boolean;
  has_garage: boolean;
  has_fence: boolean;
  has_gate: boolean;
  has_attic_space: boolean;
}

const FEATURE_LABELS: { key: keyof FeaturesData; label: string }[] = [
  { key: 'has_pool', label: 'Pool' },
  { key: 'has_sprinkler_system', label: 'Sprinkler System' },
  { key: 'has_central_hvac', label: 'Central HVAC' },
  { key: 'has_furnace', label: 'Furnace' },
  { key: 'has_fireplace', label: 'Fireplace' },
  { key: 'has_gas_line', label: 'Gas Line' },
  { key: 'has_septic', label: 'Septic System' },
  { key: 'has_well_water', label: 'Well Water' },
  { key: 'has_garage', label: 'Garage' },
  { key: 'has_fence', label: 'Fence' },
  { key: 'has_gate', label: 'Gate' },
  { key: 'has_attic_space', label: 'Attic Space' },
];

export default function NewHomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState<AddressData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: 'TX',
    zip_code: '',
  });

  const [property, setProperty] = useState<PropertyData>({
    sqft: '',
    year_built: '',
    bedrooms: '',
    bathrooms: '',
    lot_sqft: '',
    stories: '',
  });

  const [features, setFeatures] = useState<FeaturesData>({
    has_pool: false,
    has_sprinkler_system: false,
    has_central_hvac: false,
    has_furnace: false,
    has_fireplace: false,
    has_gas_line: false,
    has_septic: false,
    has_well_water: false,
    has_garage: false,
    has_fence: false,
    has_gate: false,
    has_attic_space: false,
  });

  function canAdvance(): boolean {
    if (step === 0) {
      return (
        address.address_line_1.trim() !== '' &&
        address.city.trim() !== '' &&
        address.state.trim() !== '' &&
        /^\d{5}$/.test(address.zip_code)
      );
    }
    return true;
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      // Build the home payload
      const homeBody: Record<string, unknown> = {
        address_line_1: address.address_line_1.trim(),
        city: address.city.trim(),
        state: address.state,
        zip_code: address.zip_code.trim(),
      };

      if (address.address_line_2.trim()) {
        homeBody.address_line_2 = address.address_line_2.trim();
      }
      if (property.sqft) homeBody.sqft = parseInt(property.sqft, 10);
      if (property.year_built) homeBody.year_built = parseInt(property.year_built, 10);
      if (property.bedrooms) homeBody.bedrooms = parseInt(property.bedrooms, 10);
      if (property.bathrooms) homeBody.bathrooms = parseFloat(property.bathrooms);
      if (property.lot_sqft) homeBody.lot_sqft = parseInt(property.lot_sqft, 10);
      if (property.stories) homeBody.stories = parseInt(property.stories, 10);

      // Step 1: Create the home
      const homeRes = await fetch('/api/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homeBody),
      });

      if (!homeRes.ok) {
        const data = await homeRes.json();
        throw new Error(data.error || 'Failed to create home');
      }

      const { home } = await homeRes.json();

      // Step 2: Save features if any are selected
      const hasAnyFeature = Object.values(features).some(Boolean);
      if (hasAnyFeature) {
        const featuresRes = await fetch(`/api/homes/${home.id}/features`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(features),
        });

        if (!featuresRes.ok) {
          // Features save failed but home was created -- navigate anyway
          console.error('Failed to save home features');
        }
      }

      router.push(`/homes/${home.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <Link
        href="/homes"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--hw-text-secondary)] transition-colors hover:text-[var(--hw-text)]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to My Homes
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-[var(--hw-text)]">Add a Home</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
        Tell us about your property so we can match you with the right services.
      </p>

      {/* Step progress bar */}
      <div className="mt-6 flex gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-[var(--hw-bg-tertiary)]'
              }`}
            />
            <p
              className={`mt-1.5 text-xs font-medium ${
                i <= step ? 'text-primary' : 'text-[var(--hw-text-tertiary)]'
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-6 shadow-sm dark:bg-[var(--hw-bg)]">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Address */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">Property Address</h2>
            <p className="text-sm text-[var(--hw-text-secondary)]">
              Enter the address of the property you want to add.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                Address Line 1 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={address.address_line_1}
                onChange={(e) => setAddress({ ...address, address_line_1: e.target.value })}
                placeholder="123 Main Street"
                className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                Address Line 2 <span className="text-[var(--hw-text-tertiary)]">(optional)</span>
              </label>
              <input
                type="text"
                value={address.address_line_2}
                onChange={(e) => setAddress({ ...address, address_line_2: e.target.value })}
                placeholder="Apt, Suite, Unit"
                className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <div className="col-span-2 sm:col-span-3">
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Dallas"
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.zip_code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setAddress({ ...address, zip_code: val });
                  }}
                  placeholder="75201"
                  maxLength={5}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Property Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">Property Details</h2>
            <p className="text-sm text-[var(--hw-text-secondary)]">
              These details help us recommend the right services and pricing for your home.
              All fields are optional.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Square Footage
                </label>
                <input
                  type="text"
                  value={property.sqft}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setProperty({ ...property, sqft: val });
                  }}
                  placeholder="e.g. 2400"
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Year Built
                </label>
                <input
                  type="text"
                  value={property.year_built}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setProperty({ ...property, year_built: val });
                  }}
                  placeholder="e.g. 1998"
                  maxLength={4}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Bedrooms
                </label>
                <select
                  value={property.bedrooms}
                  onChange={(e) => setProperty({ ...property, bedrooms: e.target.value })}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">--</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}{n === 6 ? '+' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Bathrooms
                </label>
                <select
                  value={property.bathrooms}
                  onChange={(e) => setProperty({ ...property, bathrooms: e.target.value })}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">--</option>
                  {['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Lot Size (sqft)
                </label>
                <input
                  type="text"
                  value={property.lot_sqft}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setProperty({ ...property, lot_sqft: val });
                  }}
                  placeholder="e.g. 8500"
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] placeholder:text-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--hw-text)]">
                  Stories
                </label>
                <select
                  value={property.stories}
                  onChange={(e) => setProperty({ ...property, stories: e.target.value })}
                  className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2.5 text-sm text-[var(--hw-text)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">--</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3+</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Home Features */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">Home Features</h2>
            <p className="text-sm text-[var(--hw-text-secondary)]">
              Select the features your home has. This helps us match you with
              compatible services through HomeFit.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURE_LABELS.map(({ key, label }) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    features[key]
                      ? 'border-primary bg-primary/5 text-[var(--hw-text)]'
                      : 'border-[var(--hw-border)] bg-white text-[var(--hw-text-secondary)] hover:border-[var(--hw-text-tertiary)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={features[key]}
                    onChange={(e) =>
                      setFeatures({ ...features, [key]: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-[var(--hw-border)] pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hw-border)] px-4 py-2.5 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Save Home
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
