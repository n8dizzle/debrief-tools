'use client';

import { useState, useEffect } from 'react';

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface CatalogService {
  id: string;
  category_id: string;
  name: string;
  description: string;
  pricing_type: string;
  estimated_duration_min: number | null;
  estimated_duration_max: number | null;
  catalog_categories: {
    id: string;
    name: string;
    department_id: string;
    catalog_departments: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface ContractorPrice {
  id: string;
  service_id: string;
  base_price: number;
  is_active: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDuration(min: number | null, max: number | null): string {
  if (min == null && max == null) return '';
  if (min != null && max != null) return `${min}-${max} min`;
  if (min != null) return `~${min} min`;
  return `~${max} min`;
}

export default function PricebookPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [prices, setPrices] = useState<ContractorPrice[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [editingService, setEditingService] = useState<CatalogService | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogRes, pricesRes] = await Promise.all([
          fetch('/api/catalog'),
          fetch('/api/prices'),
        ]);

        if (!catalogRes.ok) throw new Error('Failed to load catalog');
        if (!pricesRes.ok) throw new Error('Failed to load prices');

        const catalogData = await catalogRes.json();
        const pricesData = await pricesRes.json();

        setDepartments(catalogData.departments || []);
        setServices(catalogData.services || []);
        setPrices(pricesData.prices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const priceMap = new Map<string, ContractorPrice>();
  prices.forEach((p) => priceMap.set(p.service_id, p));

  const filtered = services.filter((s) => {
    const deptName = s.catalog_categories?.catalog_departments?.name || '';
    const matchesDept = activeDepartment === 'All' || deptName === activeDepartment;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const activeCount = services.filter((s) => priceMap.has(s.id) && priceMap.get(s.id)!.is_active).length;

  function openPriceModal(service: CatalogService) {
    const existing = priceMap.get(service.id);
    setEditingService(service);
    setEditPrice(existing ? String(existing.base_price / 100) : '');
  }

  async function savePrice() {
    if (!editingService || !editPrice) return;
    setSaving(true);

    try {
      const basePriceCents = Math.round(parseFloat(editPrice) * 100);
      const existing = priceMap.get(editingService.id);

      let res: Response;
      if (existing) {
        res = await fetch(`/api/prices/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base_price: basePriceCents, is_active: true }),
        });
      } else {
        res = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_id: editingService.id, base_price: basePriceCents }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save price');
      }

      const data = await res.json();
      const newPrice = data.price;

      setPrices((prev) => {
        const idx = prev.findIndex((p) => p.service_id === editingService.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newPrice;
          return updated;
        }
        return [...prev, newPrice];
      });

      setEditingService(null);
      setEditPrice('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function removePrice(serviceId: string) {
    if (!confirm('Remove your price for this service?')) return;

    try {
      const res = await fetch(`/api/prices/${serviceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove price');
      setPrices((prev) => prev.filter((p) => p.service_id !== serviceId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-default)',
            borderTopColor: 'var(--hw-blue)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading catalog...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ color: 'var(--status-error)', marginBottom: '0.5rem' }}>{error}</div>
        <button className="btn-secondary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem',
            }}
          >
            Price Book
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Set your prices for catalog services. {activeCount} of {services.length} services priced.
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            className="input"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Department Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveDepartment('All')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '9999px',
            border: '1px solid',
            borderColor: activeDepartment === 'All' ? 'var(--hw-blue)' : 'var(--border-default)',
            background: activeDepartment === 'All' ? 'var(--hw-blue)' : 'transparent',
            color: activeDepartment === 'All' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All
        </button>
        {departments.map((dept) => (
          <button
            key={dept.id}
            onClick={() => setActiveDepartment(dept.name)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: activeDepartment === dept.name ? 'var(--hw-blue)' : 'var(--border-default)',
              background: activeDepartment === dept.name ? 'var(--hw-blue)' : 'transparent',
              color: activeDepartment === dept.name ? 'white' : 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {dept.name}
          </button>
        ))}
      </div>

      {/* Services List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map((service) => {
          const myPrice = priceMap.get(service.id);
          const isActive = myPrice?.is_active;

          return (
            <div
              key={service.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.375rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {service.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: 'var(--bg-input)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {service.catalog_categories?.catalog_departments?.name || 'Uncategorized'}
                  </span>
                  {service.pricing_type && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        background: 'var(--status-info-bg)',
                        color: 'var(--status-info)',
                      }}
                    >
                      {service.pricing_type}
                    </span>
                  )}
                  {isActive && (
                    <span className="badge badge-success">Active</span>
                  )}
                </div>
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {service.description}
                </p>
                {formatDuration(service.estimated_duration_min, service.estimated_duration_max) && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Est. duration: {formatDuration(service.estimated_duration_min, service.estimated_duration_max)}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginLeft: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {myPrice ? (
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        marginBottom: '0.125rem',
                      }}
                    >
                      Your Price
                    </div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--status-success)',
                      }}
                    >
                      {formatCents(myPrice.base_price)}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    No price set
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={myPrice ? 'btn-secondary' : 'btn-primary'}
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => openPriceModal(service)}
                  >
                    {myPrice ? 'Edit Price' : 'Set Price'}
                  </button>
                  {myPrice && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.625rem 0.75rem', color: 'var(--status-error)' }}
                      onClick={() => removePrice(service.id)}
                      title="Remove price"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--text-muted)',
            }}
          >
            No services found matching your criteria.
          </div>
        )}
      </div>

      {/* Price Modal */}
      {editingService && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingService(null);
              setEditPrice('');
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '440px',
              maxWidth: '90vw',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 0.5rem',
              }}
            >
              {priceMap.has(editingService.id) ? 'Edit Price' : 'Set Price'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              {editingService.name}
            </p>

            {formatDuration(editingService.estimated_duration_min, editingService.estimated_duration_max) && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Est. duration: {formatDuration(editingService.estimated_duration_min, editingService.estimated_duration_max)}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Your Price (dollars)
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  style={{ paddingLeft: '1.75rem' }}
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingService(null);
                  setEditPrice('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={savePrice}
                disabled={saving || !editPrice || parseFloat(editPrice) <= 0}
              >
                {saving ? 'Saving...' : 'Save Price'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
