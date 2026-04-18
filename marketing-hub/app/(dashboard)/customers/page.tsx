'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  st_customer_id: string;
  customer_name: string;
  created_on: string;
  customer_type: string;
  member_status: string;
  original_campaign: string | null;
  created_by: string | null;
  city: string | null;
  full_address: string | null;
  completed_revenue: number;
  total_sales: number;
  lifetime_revenue: number;
  completed_jobs: number;
  last_job_completed: string | null;
  lat: number | null;
  lng: number | null;
}

// ============================================
// GOOGLE MAPS LOADER
// ============================================

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDq5XNNwiVUfqea_3PSl7SZIWzmAhN79H8';

let mapsLoaded = false;
let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (mapsLoaded) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('No window');
    if ((window as any).google?.maps) {
      mapsLoaded = true;
      return resolve();
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
    script.async = true;
    script.onload = () => {
      mapsLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatNumber(val: number): string {
  return val.toLocaleString();
}

function getDefaultDateRange(): DateRange {
  return { start: '2025-01-01', end: '2026-04-17' };
}

// Normalize campaign names for grouping
function normalizeCampaign(campaign: string | null): string {
  if (!campaign || campaign.trim() === '') return 'Unknown';
  const c = campaign.trim();
  if (c.startsWith('GBP')) return 'Google Business Profile';
  if (c.includes('Branded Search') || c.includes('Website Phone')) return 'Branded Search / Website';
  if (c.includes('Referral')) return 'Referral';
  if (c.includes('LSA') || c.includes('Google LSA')) return 'Google LSA';
  if (c.includes('Imported Default')) return 'Imported / Default';
  if (c.includes('Existing Customer')) return 'Existing Customer';
  if (c.includes('Outbound')) return 'Outbound';
  if (c.includes('Email')) return 'Email';
  if (c.includes('Facebook')) return 'Facebook';
  if (c === 'eLocal') return 'eLocal';
  if (c === 'Modernize') return 'Modernize';
  if (c === 'Nextdoor') return 'Nextdoor';
  if (c === 'Mims') return 'Mims';
  return 'Other';
}

// Campaign colors
const CAMPAIGN_COLORS: Record<string, string> = {
  'Google Business Profile': '#5D8A66',
  'Branded Search / Website': '#B8956B',
  'Referral': '#7B9BAE',
  'Google LSA': '#9B7BB8',
  'Imported / Default': '#6B7C6E',
  'Existing Customer': '#5A8F8F',
  'Outbound': '#B87B7B',
  'Facebook': '#4267B2',
  'eLocal': '#D4A574',
  'Modernize': '#74A8D4',
  'Nextdoor': '#8BC34A',
  'Email': '#FF9800',
  'Mims': '#795548',
  'Other': '#999',
  'Unknown': '#666',
};

// ============================================
// COMPONENTS
// ============================================

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: 'var(--christmas-cream)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function CustomersPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'cities' | 'campaigns' | 'list'>('map');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const heatmapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // ---- DATA FETCHING ----
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('start', dateRange.start);
      if (dateRange.end) params.set('end', dateRange.end);

      const res = await fetch(`/api/customers?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setCustomers(json.customers || []);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- GEOCODING ----
  const runGeocode = async () => {
    setGeocoding(true);
    setGeocodeStatus('Geocoding...');
    let total = 0;

    try {
      // Keep calling until all are done
      for (let i = 0; i < 40; i++) {
        const res = await fetch('/api/customers/geocode', {
          method: 'POST',
          credentials: 'include',
        });
        const json = await res.json();
        total += json.geocoded || 0;
        setGeocodeStatus(`Geocoded ${total} addresses... ${json.remaining} remaining`);

        if (!json.remaining || json.remaining === 0) break;
      }
      setGeocodeStatus(`Done! Geocoded ${total} addresses`);
      fetchData(); // Refresh data
    } catch (err) {
      setGeocodeStatus('Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  };

  // ---- FILTERED DATA ----
  const filtered = customers.filter(c => {
    if (filterType !== 'all' && c.customer_type !== filterType) return false;
    if (filterCampaign !== 'all' && normalizeCampaign(c.original_campaign) !== filterCampaign) return false;
    if (selectedCity && c.city !== selectedCity) return false;
    return true;
  });

  const geocodedCustomers = filtered.filter(c => c.lat && c.lng && c.lat !== 0 && c.lng !== 0);
  const ungeocodedCount = customers.filter(c => !c.lat && c.full_address).length;

  // ---- ANALYTICS ----
  const totalRevenue = filtered.reduce((s, c) => s + (c.lifetime_revenue || 0), 0);
  const avgRevenue = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const residentialCount = filtered.filter(c => c.customer_type === 'Residential').length;
  const commercialCount = filtered.filter(c => c.customer_type === 'Commercial').length;
  const activeMembers = filtered.filter(c => c.member_status === 'Active').length;

  // City breakdown
  const cityMap = new Map<string, { count: number; revenue: number }>();
  filtered.forEach(c => {
    const city = c.city || 'Unknown';
    const existing = cityMap.get(city) || { count: 0, revenue: 0 };
    cityMap.set(city, {
      count: existing.count + 1,
      revenue: existing.revenue + (c.lifetime_revenue || 0),
    });
  });
  const cityData = Array.from(cityMap.entries())
    .map(([city, data]) => ({ city, ...data }))
    .sort((a, b) => b.count - a.count);

  // Campaign breakdown
  const campaignMap = new Map<string, { count: number; revenue: number }>();
  filtered.forEach(c => {
    const campaign = normalizeCampaign(c.original_campaign);
    const existing = campaignMap.get(campaign) || { count: 0, revenue: 0 };
    campaignMap.set(campaign, {
      count: existing.count + 1,
      revenue: existing.revenue + (c.lifetime_revenue || 0),
    });
  });
  const campaignData = Array.from(campaignMap.entries())
    .map(([campaign, data]) => ({ campaign, ...data }))
    .sort((a, b) => b.count - a.count);

  // Unique campaigns for filter
  const uniqueCampaigns = Array.from(new Set(customers.map(c => normalizeCampaign(c.original_campaign)))).sort();

  // ---- GOOGLE MAPS ----
  useEffect(() => {
    if (activeTab !== 'map' || !mapRef.current || geocodedCustomers.length === 0) return;

    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const google = (window as any).google;

      // Center on DFW area
      const center = { lat: 33.1, lng: -97.05 };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: 10,
          mapTypeId: 'roadmap',
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
            { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6a6a7a' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        });
      }

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Heatmap data
      const heatmapData = geocodedCustomers.map(c => ({
        location: new google.maps.LatLng(c.lat!, c.lng!),
        weight: Math.max(1, Math.log10(c.lifetime_revenue || 1)),
      }));

      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }

      heatmapRef.current = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: mapInstanceRef.current,
        radius: 25,
        opacity: 0.7,
        gradient: [
          'rgba(0, 0, 0, 0)',
          'rgba(93, 138, 102, 0.4)',
          'rgba(93, 138, 102, 0.6)',
          'rgba(184, 149, 107, 0.7)',
          'rgba(184, 149, 107, 0.85)',
          'rgba(245, 240, 225, 0.9)',
          'rgba(245, 240, 225, 1)',
        ],
      });

      // Add individual markers for high-value customers
      const highValue = geocodedCustomers
        .filter(c => c.lifetime_revenue >= 10000)
        .sort((a, b) => b.lifetime_revenue - a.lifetime_revenue)
        .slice(0, 100);

      highValue.forEach(c => {
        const marker = new google.maps.Marker({
          position: { lat: c.lat!, lng: c.lng! },
          map: mapInstanceRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: c.lifetime_revenue >= 25000 ? '#B8956B' : '#5D8A66',
            fillOpacity: 0.9,
            strokeColor: '#F5F0E1',
            strokeWeight: 1,
            scale: Math.min(12, 4 + Math.log10(c.lifetime_revenue) * 2),
          },
          title: `${c.customer_name}: ${formatCurrency(c.lifetime_revenue)}`,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="color:#1a1a2e;padding:4px;min-width:200px">
              <div style="font-weight:bold;font-size:14px">${c.customer_name}</div>
              <div style="margin-top:4px;font-size:12px;color:#555">${c.city || ''}</div>
              <div style="margin-top:6px">
                <span style="font-weight:bold;color:#5D8A66;font-size:16px">${formatCurrency(c.lifetime_revenue)}</span>
                <span style="color:#888;font-size:11px;margin-left:6px">lifetime</span>
              </div>
              <div style="margin-top:4px;font-size:11px;color:#777">
                ${c.completed_jobs} jobs | ${c.customer_type} | ${c.original_campaign || 'No campaign'}
              </div>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.push(marker);
      });
    });

    return () => { cancelled = true; };
  }, [activeTab, geocodedCustomers]);

  // ---- RENDER ----
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }} />
          <div style={{ color: 'var(--text-muted)' }}>Loading customer data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Customer Map
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {formatNumber(filtered.length)} new customers | {formatCurrency(totalRevenue)} lifetime revenue
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="New Customers" value={formatNumber(filtered.length)} sub={`${residentialCount} res / ${commercialCount} com`} />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <StatCard label="Avg Revenue" value={formatCurrency(avgRevenue)} />
        <StatCard label="Active Members" value={formatNumber(activeMembers)} sub={`${((activeMembers / filtered.length) * 100).toFixed(1)}% conversion`} />
        <StatCard label="Top City" value={cityData[0]?.city || '-'} sub={`${cityData[0]?.count || 0} customers`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <option value="all">All Types</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
        </select>

        <select
          value={filterCampaign}
          onChange={e => setFilterCampaign(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <option value="all">All Campaigns</option>
          {uniqueCampaigns.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {selectedCity && (
          <button
            onClick={() => setSelectedCity(null)}
            className="rounded-md px-3 py-1.5 text-sm flex items-center gap-1"
            style={{ background: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            {selectedCity} &times;
          </button>
        )}

        {ungeocodedCount > 0 && (
          <button
            onClick={runGeocode}
            disabled={geocoding}
            className="ml-auto rounded-md px-3 py-1.5 text-sm"
            style={{
              background: geocoding ? 'var(--bg-card)' : 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
              opacity: geocoding ? 0.6 : 1,
            }}
          >
            {geocoding ? geocodeStatus : `Geocode ${ungeocodedCount} addresses`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
        {(['map', 'cities', 'campaigns', 'list'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: activeTab === tab ? 'var(--christmas-green)' : 'transparent',
              color: activeTab === tab ? 'var(--christmas-cream)' : 'var(--text-secondary)',
            }}
          >
            {tab === 'map' ? 'Heat Map' : tab === 'cities' ? 'By City' : tab === 'campaigns' ? 'By Campaign' : 'All Customers'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div
            ref={mapRef}
            className="rounded-lg overflow-hidden"
            style={{
              height: '600px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          />
          {geocodedCustomers.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              No geocoded customers yet. Click "Geocode addresses" to plot customers on the map.
            </div>
          )}
          <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Heat intensity = customer density</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#5D8A66' }} />
              $10K+ customer
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#B8956B' }} />
              $25K+ customer
            </span>
          </div>
        </div>
      )}

      {activeTab === 'cities' && (
        <div className="space-y-4">
          {/* City bar chart */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
              Customers by City (Top 20)
            </h3>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData.slice(0, 20)} layout="vertical" margin={{ left: 100, right: 30 }}>
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="city"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'count') return [value, 'Customers'];
                      return [formatCurrency(value), 'Revenue'];
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {cityData.slice(0, 20).map((entry, i) => (
                      <Cell
                        key={entry.city}
                        fill={i < 5 ? 'var(--christmas-green)' : 'var(--christmas-green-dark)'}
                        cursor="pointer"
                        onClick={() => setSelectedCity(entry.city)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* City table */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>City</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Customers</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Avg Ticket</th>
                </tr>
              </thead>
              <tbody>
                {cityData.map(row => (
                  <tr
                    key={row.city}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => setSelectedCity(row.city === selectedCity ? null : row.city)}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{row.city}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{row.count}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--christmas-green-light)' }}>{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(row.revenue / row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Campaign bar chart */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
              Customers by Campaign Source
            </h3>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData} layout="vertical" margin={{ left: 160, right: 30 }}>
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="campaign"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'count') return [value, 'Customers'];
                      return [formatCurrency(value), 'Revenue'];
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {campaignData.map(entry => (
                      <Cell
                        key={entry.campaign}
                        fill={CAMPAIGN_COLORS[entry.campaign] || '#666'}
                        cursor="pointer"
                        onClick={() => setFilterCampaign(entry.campaign === filterCampaign ? 'all' : entry.campaign)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campaign table */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Campaign</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Customers</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Avg Revenue</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {campaignData.map(row => (
                  <tr
                    key={row.campaign}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => setFilterCampaign(row.campaign === filterCampaign ? 'all' : row.campaign)}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: CAMPAIGN_COLORS[row.campaign] || '#666' }} />
                        {row.campaign}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{row.count}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--christmas-green-light)' }}>{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(row.revenue / row.count)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-muted)' }}>
                      {((row.count / filtered.length) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div
          className="rounded-lg overflow-auto"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', maxHeight: '600px' }}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Customer</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>City</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Campaign</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Jobs</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-2.5 font-medium truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>
                    {c.customer_name}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.city || '-'}</td>
                  <td className="px-4 py-2.5 truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                    {c.original_campaign || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                    {formatCurrency(c.lifetime_revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{c.completed_jobs}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: c.customer_type === 'Residential' ? 'rgba(93,138,102,0.15)' : 'rgba(184,149,107,0.15)',
                      color: c.customer_type === 'Residential' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)',
                    }}>
                      {c.customer_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{c.created_on}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="text-center py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing 200 of {filtered.length} customers
            </div>
          )}
        </div>
      )}
    </div>
  );
}
