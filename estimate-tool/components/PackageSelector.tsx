'use client';

import { Package, getInstallItemsTotal, getWarrantiesTotal } from '@/types/estimate';
import ImagePlaceholder from './ImagePlaceholder';

interface PackageSelectorProps {
  packages: Package[];
  onSelect: (pkg: Package) => void;
  onClose: () => void;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function getPackageTotal(pkg: Package): number {
  const eq = pkg.equipment.reduce((s, e) => s + e.retailPrice, 0);
  const ao = pkg.addOns.reduce((s, a) => s + a.price, 0);
  const install = getInstallItemsTotal(pkg.installItems);
  const warranty = getWarrantiesTotal(pkg.warranties);
  return eq + ao + install + warranty + pkg.laborCost;
}

const tierBadge: Record<string, string> = {
  good: 'bg-gray-100 text-gray-600',
  better: 'bg-blue-50 text-blue-600',
  best: 'bg-amber-50 text-amber-700',
};

export default function PackageSelector({ packages, onSelect, onClose }: PackageSelectorProps) {
  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Quick Start with a Package</h3>
          <p className="text-sm text-gray-500">Select a pre-built package to fill an option instantly. You can customize after.</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => {
          const total = getPackageTotal(pkg);
          return (
            <button
              key={pkg.id}
              onClick={() => onSelect(pkg)}
              className="text-left p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all bg-white"
            >
              <div className="flex items-start gap-3 mb-3">
                <ImagePlaceholder src={pkg.imageUrl} alt={pkg.name} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${tierBadge[pkg.tier]}`}>{pkg.tier}</span>
                  </div>
                  <div className="font-semibold text-gray-900 mt-1">{pkg.name}</div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{pkg.description}</p>

              {/* What's included */}
              <div className="space-y-1 mb-3">
                {pkg.equipment.map(eq => (
                  <div key={eq.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-[var(--christmas-green)]">&#10003;</span>{eq.name}
                  </div>
                ))}
                {pkg.addOns.map(ao => (
                  <div key={ao.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-[var(--christmas-green)]">&#10003;</span>{ao.name}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="text-[var(--christmas-green)]">&#10003;</span>{pkg.installItems.length} install items included
                </div>
                {pkg.warranties.map(w => (
                  <div key={w.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-blue-500">&#9733;</span>{w.name}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-lg font-bold text-gray-900">{fmt(total)}</span>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">Use Package</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
