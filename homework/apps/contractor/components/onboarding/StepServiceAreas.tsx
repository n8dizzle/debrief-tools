'use client';

import { useState } from 'react';

// Common DFW zip codes (same as signup page)
const DFW_ZIP_CODES = [
  '75001', '75002', '75006', '75007', '75009', '75010', '75013', '75019', '75023', '75024',
  '75025', '75028', '75034', '75035', '75038', '75039', '75040', '75041', '75042', '75043',
  '75044', '75048', '75050', '75051', '75052', '75054', '75056', '75057', '75060', '75061',
  '75062', '75063', '75065', '75067', '75068', '75069', '75070', '75071', '75074', '75075',
  '75077', '75078', '75080', '75081', '75082', '75083', '75087', '75088', '75089', '75093',
  '75094', '75098', '75104', '75115', '75116', '75134', '75137', '75141', '75142', '75143',
  '75146', '75149', '75150', '75154', '75159', '75160', '75166', '75167', '75172', '75180',
  '75181', '75182', '75189', '75201', '75202', '75203', '75204', '75205', '75206', '75207',
  '75208', '75209', '75210', '75211', '75212', '75214', '75215', '75216', '75217', '75218',
  '75219', '75220', '75223', '75224', '75225', '75226', '75227', '75228', '75229', '75230',
  '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240', '75241',
  '75243', '75244', '75246', '75247', '75248', '75249', '75251', '75252', '75253', '75254',
  '75270', '75287', '76001', '76002', '76006', '76010', '76011', '76012', '76013', '76014',
  '76015', '76016', '76017', '76018', '76020', '76021', '76022', '76028', '76034', '76039',
  '76040', '76051', '76052', '76053', '76054', '76060', '76063', '76065', '76092', '76109',
  '76111', '76112', '76116', '76117', '76118', '76119', '76120', '76126', '76127', '76131',
  '76132', '76133', '76134', '76135', '76137', '76140', '76148', '76155', '76177', '76180',
  '76182', '76201', '76205', '76207', '76208', '76209', '76210', '76226', '76227', '76234',
  '76244', '76247', '76248', '76249', '76258', '76262',
];

export interface ServiceAreasData {
  all_dfw: boolean;
  zip_codes: string[];
}

interface StepServiceAreasProps {
  data: ServiceAreasData;
  onChange: (data: ServiceAreasData) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepServiceAreas({ data, onChange, onNext, onBack }: StepServiceAreasProps) {
  const [zipSearch, setZipSearch] = useState('');

  function toggleZip(zip: string) {
    const updated = data.zip_codes.includes(zip)
      ? data.zip_codes.filter((z) => z !== zip)
      : [...data.zip_codes, zip];
    onChange({ ...data, zip_codes: updated });
  }

  function handleNext() {
    const zipCodes = data.all_dfw ? DFW_ZIP_CODES : data.zip_codes;
    if (zipCodes.length === 0) return;
    // Save with actual zip codes
    onChange({ ...data, zip_codes: zipCodes });
    onNext();
  }

  const filteredZips = zipSearch
    ? DFW_ZIP_CODES.filter((z) => z.startsWith(zipSearch))
    : DFW_ZIP_CODES;

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
        Service Areas
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Where does your business serve?
      </p>

      {/* All DFW Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          background: data.all_dfw ? 'var(--status-info-bg, #F0FAF8)' : 'var(--bg-input)',
          border: `2px solid ${data.all_dfw ? 'var(--hw-blue)' : 'var(--border-default)'}`,
          borderRadius: '10px',
          marginBottom: '1rem',
          cursor: 'pointer',
        }}
        onClick={() => onChange({ ...data, all_dfw: !data.all_dfw })}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: `2px solid ${data.all_dfw ? 'var(--hw-blue)' : 'var(--border-default)'}`,
            background: data.all_dfw ? 'var(--hw-blue)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {data.all_dfw && (
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            All DFW Metroplex
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Serve the entire Dallas-Fort Worth area ({DFW_ZIP_CODES.length} zip codes)
          </div>
        </div>
      </div>

      {!data.all_dfw && (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="input"
              placeholder="Search zip codes..."
              value={zipSearch}
              onChange={(e) => setZipSearch(e.target.value)}
            />
          </div>

          <div
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.375rem',
              marginBottom: '1rem',
              padding: '0.5rem',
              background: 'var(--bg-input)',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
            }}
          >
            {filteredZips.map((zip) => {
              const isSelected = data.zip_codes.includes(zip);
              return (
                <button
                  key={zip}
                  type="button"
                  onClick={() => toggleZip(zip)}
                  style={{
                    padding: '0.375rem 0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--hw-blue)' : 'transparent'}`,
                    background: isSelected ? 'var(--status-info-bg, #F0FAF8)' : 'transparent',
                    color: isSelected ? 'var(--hw-blue-light)' : 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {zip}
                </button>
              );
            })}
          </div>

          {data.zip_codes.length > 0 && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {data.zip_codes.length} zip code{data.zip_codes.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={onBack} style={{ flex: 1, padding: '0.75rem' }}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleNext}
          disabled={!data.all_dfw && data.zip_codes.length === 0}
          style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export { DFW_ZIP_CODES };
