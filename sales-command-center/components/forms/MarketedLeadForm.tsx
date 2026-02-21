'use client';

import { useState } from 'react';
import { MarketedLeadInput, MarketedLeadSource, SystemType } from '@/types';
import { marketedLeadSchema, getFieldError } from '@/lib/validations';
import { ZodError } from 'zod';
import { AlertCircle } from 'lucide-react';

const LEAD_SOURCES: MarketedLeadSource[] = [
  'Google Ads',
  'Facebook',
  'Referral',
  'Website',
  'Direct Mail',
  'Other',
];

const SYSTEM_TYPES: SystemType[] = [
  'Gas',
  'Heat Pump',
  'Unknown',
];

interface MarketedLeadFormProps {
  onSubmit: (data: MarketedLeadInput) => void;
  isSubmitting?: boolean;
}

export function MarketedLeadForm({ onSubmit, isSubmitting = false }: MarketedLeadFormProps) {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    source: 'Google Ads' as MarketedLeadSource,
    unitAge: '',
    systemType: 'Unknown' as SystemType,
    address: '',
    notes: '',
  });

  const [errors, setErrors] = useState<ZodError | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const handleBlur = (field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const unitAgeNum = formData.unitAge ? parseInt(formData.unitAge, 10) : undefined;

    const dataToValidate = {
      customerName: formData.customerName.trim(),
      phone: formData.phone.trim(),
      source: formData.source,
      unitAge: unitAgeNum,
      systemType: formData.systemType,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    const result = marketedLeadSchema.safeParse(dataToValidate);

    if (!result.success) {
      setErrors(result.error);
      // Mark all fields as touched on submit attempt
      setTouched(new Set(['customerName', 'phone', 'source', 'unitAge', 'systemType', 'address', 'notes']));
      return;
    }

    setErrors(null);
    onSubmit(dataToValidate);
  };

  const handleReset = () => {
    setFormData({
      customerName: '',
      phone: '',
      source: 'Google Ads',
      unitAge: '',
      systemType: 'Unknown',
      address: '',
      notes: '',
    });
    setErrors(null);
    setTouched(new Set());
  };

  const getError = (field: string) => {
    if (!touched.has(field)) return undefined;
    return getFieldError(errors, field);
  };

  const inputClasses = (field: string) => {
    const error = getError(field);
    return `w-full px-4 py-2.5 rounded-lg bg-background border text-foreground focus:outline-none focus:ring-2 transition-all ${
      error
        ? 'border-red-500 focus:ring-red-500/50'
        : 'border-border focus:ring-primary'
    }`;
  };

  const labelClasses = "block text-sm font-medium text-muted-foreground mb-1.5";

  const ErrorMessage = ({ field }: { field: string }) => {
    const error = getError(field);
    if (!error) return null;
    return (
      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Name */}
        <div>
          <label className={labelClasses}>
            Customer Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            onBlur={() => handleBlur('customerName')}
            placeholder="Enter customer name"
            className={inputClasses('customerName')}
            disabled={isSubmitting}
          />
          <ErrorMessage field="customerName" />
        </div>

        {/* Phone */}
        <div>
          <label className={labelClasses}>
            Phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            onBlur={() => handleBlur('phone')}
            placeholder="(555) 123-4567"
            className={inputClasses('phone')}
            disabled={isSubmitting}
          />
          <ErrorMessage field="phone" />
        </div>

        {/* Source */}
        <div>
          <label className={labelClasses}>
            Lead Source <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value as MarketedLeadSource })}
            onBlur={() => handleBlur('source')}
            className={inputClasses('source')}
            disabled={isSubmitting}
          >
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <ErrorMessage field="source" />
        </div>

        {/* System Type */}
        <div>
          <label className={labelClasses}>
            System Type
          </label>
          <select
            value={formData.systemType}
            onChange={(e) => setFormData({ ...formData, systemType: e.target.value as SystemType })}
            className={inputClasses('systemType')}
            disabled={isSubmitting}
          >
            {SYSTEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Age */}
        <div>
          <label className={labelClasses}>
            Estimated Unit Age <span className="text-muted-foreground/70">(years)</span>
          </label>
          <input
            type="number"
            min="0"
            max="50"
            value={formData.unitAge}
            onChange={(e) => setFormData({ ...formData, unitAge: e.target.value })}
            onBlur={() => handleBlur('unitAge')}
            placeholder="e.g. 15"
            className={inputClasses('unitAge')}
            disabled={isSubmitting}
          />
          <ErrorMessage field="unitAge" />
        </div>

        {/* Address */}
        <div>
          <label className={labelClasses}>
            Address <span className="text-muted-foreground/70">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            onBlur={() => handleBlur('address')}
            placeholder="123 Main St, Houston, TX"
            className={inputClasses('address')}
            disabled={isSubmitting}
          />
          <ErrorMessage field="address" />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            Notes <span className="text-muted-foreground/70">(optional)</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            onBlur={() => handleBlur('notes')}
            placeholder="Any additional notes about the lead..."
            rows={3}
            className={`${inputClasses('notes')} resize-none`}
            disabled={isSubmitting}
          />
          <ErrorMessage field="notes" />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Lead'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isSubmitting}
          className="px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
