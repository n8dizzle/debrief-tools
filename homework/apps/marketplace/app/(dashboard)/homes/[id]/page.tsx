'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';

interface Home {
  id: string;
  nickname: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  home_type: string | null;
  year_built: number | null;
  sqft: number | null;
  square_footage: number | null;
  stories: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  lot_sqft: number | null;
  lot_size_sqft: number | null;
  garage_spaces: number | null;
  is_primary: boolean;
  created_at: string;
}

interface HomeFeatures {
  home_id: string;
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
  has_ductwork: boolean;
  has_mini_split: boolean;
  has_tankless_water_heater: boolean;
  has_gutters: boolean;
  has_outdoor_kitchen: boolean;
  has_outdoor_lighting: boolean;
  has_patio_deck: boolean;
  has_pergola: boolean;
  has_gutter_guards: boolean;
  has_water_softener: boolean;
  has_disposal: boolean;
  has_ev_charger: boolean;
  has_generator: boolean;
  has_surge_protector: boolean;
  has_radiant_barrier: boolean;
  has_attic_insulation: boolean;
  has_hardwood: boolean;
  has_tile: boolean;
  has_carpet: boolean;
  has_lvp: boolean;
  [key: string]: boolean | string;
}

interface HomeSystem {
  id: string;
  system_type: string;
  brand: string | null;
  model: string | null;
  year_installed: number | null;
  fuel_type: string | null;
  capacity: string | null;
  condition: string;
  notes: string | null;
}

const HOME_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  townhouse: 'Townhouse',
  condo: 'Condo',
  apartment: 'Apartment',
  mobile_home: 'Mobile Home',
  other: 'Other',
};

const FEATURE_DISPLAY: { key: string; label: string }[] = [
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
  { key: 'has_ductwork', label: 'Ductwork' },
  { key: 'has_mini_split', label: 'Mini Split' },
  { key: 'has_tankless_water_heater', label: 'Tankless Water Heater' },
  { key: 'has_gutters', label: 'Gutters' },
  { key: 'has_outdoor_kitchen', label: 'Outdoor Kitchen' },
  { key: 'has_outdoor_lighting', label: 'Outdoor Lighting' },
  { key: 'has_patio_deck', label: 'Patio / Deck' },
  { key: 'has_water_softener', label: 'Water Softener' },
  { key: 'has_ev_charger', label: 'EV Charger' },
  { key: 'has_generator', label: 'Generator' },
  { key: 'has_attic_insulation', label: 'Attic Insulation' },
];

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  hvac: 'HVAC System',
  furnace: 'Furnace',
  water_heater: 'Water Heater',
  electrical_panel: 'Electrical Panel',
  plumbing: 'Plumbing',
  roof: 'Roof',
  pool_equipment: 'Pool Equipment',
  sprinkler_system: 'Sprinkler System',
  septic: 'Septic System',
  water_softener: 'Water Softener',
  air_purifier: 'Air Purifier',
  generator: 'Generator',
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-yellow-100 text-yellow-700',
  poor: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-700',
};

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="flex-1">
          <div className="h-7 w-56 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-2 h-4 w-80 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
        <div className="h-4 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
        <div className="h-4 w-28 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 rounded bg-[var(--hw-bg-tertiary)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [home, setHome] = useState<Home | null>(null);
  const [features, setFeatures] = useState<HomeFeatures | null>(null);
  const [systems, setSystems] = useState<HomeSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [homeRes, featuresRes, systemsRes] = await Promise.all([
          fetch(`/api/homes/${id}`),
          fetch(`/api/homes/${id}/features`),
          fetch(`/api/homes/${id}/systems`),
        ]);

        if (!homeRes.ok) {
          setError(homeRes.status === 404 ? 'Home not found' : 'Failed to load home');
          return;
        }

        const homeData = await homeRes.json();
        setHome(homeData.home || homeData);

        if (featuresRes.ok) {
          const featuresData = await featuresRes.json();
          setFeatures(featuresData.features || null);
        }

        if (systemsRes.ok) {
          const systemsData = await systemsRes.json();
          setSystems(systemsData.systems || []);
        }
      } catch (err) {
        console.error('Failed to fetch home data:', err);
        setError('Failed to load home');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/homes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/homes');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete home');
        setShowDeleteConfirm(false);
        setDeleting(false);
      }
    } catch (err) {
      console.error('Failed to delete home:', err);
      setError('Failed to delete home');
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !home) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <svg className="mx-auto h-12 w-12 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="mt-3 text-xl font-bold text-[var(--hw-text)]">{error || 'Home not found'}</h2>
        <Link
          href="/homes"
          className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-dark"
        >
          Back to My Homes
        </Link>
      </div>
    );
  }

  // Resolve sqft / square_footage column name difference
  const sqft = home.sqft ?? home.square_footage;
  const lotSqft = home.lot_sqft ?? home.lot_size_sqft;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/homes"
            className="rounded-lg p-2 text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-tertiary)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--hw-text)]">
                {home.nickname || home.address_line1}
              </h1>
              {home.is_primary && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Primary
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[var(--hw-text-secondary)]">
              {home.address_line1}
              {home.address_line2 ? `, ${home.address_line2}` : ''}, {home.city}, {home.state} {home.zip_code}
            </p>
          </div>
        </div>

        {/* Edit / Delete */}
        <div className="flex items-center gap-2">
          <Link
            href={`/homes/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hw-border)] px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Are you sure you want to delete this home? This action cannot be undone.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-[var(--hw-border)] px-4 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Property summary card */}
      <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm dark:bg-[var(--hw-bg)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--hw-text-tertiary)]">
          Property Details
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {home.home_type && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Type</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {HOME_TYPE_LABELS[home.home_type] || home.home_type}
              </dd>
            </div>
          )}
          {sqft != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Square Footage</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {sqft.toLocaleString()} sqft
              </dd>
            </div>
          )}
          {home.year_built != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Year Built</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {home.year_built}
              </dd>
            </div>
          )}
          {home.bedrooms != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Bedrooms</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {home.bedrooms}
              </dd>
            </div>
          )}
          {home.bathrooms != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Bathrooms</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {home.bathrooms}
              </dd>
            </div>
          )}
          {home.stories != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Stories</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {home.stories}
              </dd>
            </div>
          )}
          {lotSqft != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Lot Size</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {lotSqft.toLocaleString()} sqft
              </dd>
            </div>
          )}
          {home.garage_spaces != null && (
            <div>
              <dt className="text-xs text-[var(--hw-text-tertiary)]">Garage</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--hw-text)]">
                {home.garage_spaces} car{home.garage_spaces !== 1 ? 's' : ''}
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* Features section */}
      <div className="mt-4 rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm dark:bg-[var(--hw-bg)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--hw-text-tertiary)]">
          Home Features
        </h2>

        {features ? (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {FEATURE_DISPLAY.map(({ key, label }) => {
              const value = features[key];
              if (typeof value !== 'boolean') return null;
              return (
                <div key={key} className="flex items-center gap-2 py-1">
                  {value ? (
                    <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 flex-shrink-0 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span
                    className={`text-sm ${
                      value ? 'font-medium text-[var(--hw-text)]' : 'text-[var(--hw-text-tertiary)]'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--hw-text-tertiary)]">
            No features recorded yet. Edit this home to add feature details.
          </p>
        )}
      </div>

      {/* Systems section */}
      {systems.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm dark:bg-[var(--hw-bg)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--hw-text-tertiary)]">
            Home Systems
          </h2>
          <div className="mt-4 space-y-3">
            {systems.map((sys) => (
              <div
                key={sys.id}
                className="rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg-secondary)] p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--hw-text)]">
                    {SYSTEM_TYPE_LABELS[sys.system_type] || sys.system_type}
                  </h3>
                  {sys.condition && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${
                        CONDITION_COLORS[sys.condition] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {sys.condition}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--hw-text-secondary)]">
                  {sys.brand && <span>Brand: {sys.brand}</span>}
                  {sys.model && <span>Model: {sys.model}</span>}
                  {sys.year_installed && <span>Installed: {sys.year_installed}</span>}
                  {sys.fuel_type && (
                    <span>Fuel: {sys.fuel_type.charAt(0).toUpperCase() + sys.fuel_type.slice(1)}</span>
                  )}
                  {sys.capacity && <span>Capacity: {sys.capacity}</span>}
                </div>
                {sys.notes && (
                  <p className="mt-2 text-xs text-[var(--hw-text-tertiary)]">{sys.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HomeFit CTA */}
      <div className="mt-6 rounded-xl bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
        <h2 className="text-lg font-bold">Find Services for This Home</h2>
        <p className="mt-1 text-sm text-blue-100">
          Run HomeFit to discover services that match your home&apos;s features, systems, and property details.
        </p>
        <Link
          href={`/browse?home_id=${id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-blue-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Run HomeFit
        </Link>
      </div>
    </div>
  );
}
