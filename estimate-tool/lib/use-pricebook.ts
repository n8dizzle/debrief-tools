'use client';

import { useState, useEffect } from 'react';
import { Equipment, AddOn, InstallItem, Warranty, Discount, EquipmentType } from '@/types/estimate';

// Map ST equipment type strings to our EquipmentType
function mapEquipmentType(stType?: string): EquipmentType {
  if (!stType) return 'air-conditioner';
  const lower = stType.toLowerCase();
  if (lower.includes('heat pump')) return 'heat-pump';
  if (lower.includes('furnace')) return 'furnace';
  if (lower.includes('air handler')) return 'air-handler';
  if (lower.includes('mini') || lower.includes('split')) return 'mini-split';
  if (lower.includes('package')) return 'package-unit';
  return 'air-conditioner';
}

// Guess tier from price or name
function guessTier(name: string, price: number): 'good' | 'better' | 'best' {
  const lower = name.toLowerCase();
  if (lower.includes('best') || lower.includes('premium') || lower.includes('ultimate')) return 'best';
  if (lower.includes('better') || lower.includes('enhanced') || lower.includes('plus')) return 'better';
  if (lower.includes('good') || lower.includes('basic') || lower.includes('standard')) return 'good';
  // Fallback: tier by price bands
  if (price > 8000) return 'best';
  if (price > 5000) return 'better';
  return 'good';
}

// Extract SEER from description/name
function extractSeer(text: string): number | undefined {
  const match = text.match(/(\d+\.?\d*)\s*SEER/i);
  return match ? parseFloat(match[1]) : undefined;
}

function extractAfue(text: string): number | undefined {
  const match = text.match(/(\d+\.?\d*)%?\s*AFUE/i);
  return match ? parseFloat(match[1]) : undefined;
}

function extractTons(text: string): number | undefined {
  const match = text.match(/(\d+\.?\d*)\s*ton/i);
  return match ? parseFloat(match[1]) : undefined;
}

interface STItem {
  id: number;
  code: string;
  displayName?: string;
  name?: string;
  description?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  price: number;
  memberPrice?: number;
  cost?: number;
  active: boolean;
  images?: string[];
  categories?: Array<{ id: number; name?: string }>;
  manufacturerWarranty?: { duration?: string; description?: string };
  serviceProviderWarranty?: { duration?: string; description?: string };
  hours?: number;
  unitOfMeasure?: string;
}

export interface PricebookData {
  equipment: Equipment[];
  materials: InstallItem[];
  services: AddOn[];
  loading: boolean;
  error: string | null;
}

export function usePricebook(): PricebookData {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [materials, setMaterials] = useState<InstallItem[]>([]);
  const [services, setServices] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [eqRes, matRes, svcRes] = await Promise.all([
          fetch('/api/servicetitan/pricebook?type=equipment'),
          fetch('/api/servicetitan/pricebook?type=materials'),
          fetch('/api/servicetitan/pricebook?type=services'),
        ]);

        if (!eqRes.ok || !matRes.ok || !svcRes.ok) {
          throw new Error('Failed to fetch pricebook data');
        }

        const [eqData, matData, svcData] = await Promise.all([
          eqRes.json(),
          matRes.json(),
          svcRes.json(),
        ]);

        // Map ST equipment to our Equipment type
        const mappedEquipment: Equipment[] = (eqData.data || []).map((item: STItem) => {
          const displayName = item.displayName || item.name || item.code;
          const desc = item.description || '';
          const combined = `${displayName} ${desc}`;
          return {
            id: `st-eq-${item.id}`,
            name: displayName,
            brand: item.manufacturer || '',
            model: item.model || '',
            type: mapEquipmentType(item.type),
            description: desc,
            features: [],
            seer: extractSeer(combined),
            afue: extractAfue(combined),
            tons: extractTons(combined),
            imageUrl: item.images?.[0],
            retailPrice: item.price || 0,
            tier: guessTier(displayName, item.price || 0),
            stSkuId: item.id,
            stCode: item.code,
          };
        });

        // Map ST materials to our InstallItem type
        const mappedMaterials: InstallItem[] = (matData.data || []).map((item: STItem) => ({
          id: `st-mat-${item.id}`,
          name: item.displayName || item.name || item.code,
          description: item.description,
          category: mapMaterialCategory(item.categories),
          unitCost: item.price || 0,
          quantity: 1,
          stSkuId: item.id,
          stCode: item.code,
        }));

        // Map ST services to our AddOn type (services include labor, IAQ, etc.)
        const mappedServices: AddOn[] = (svcData.data || []).map((item: STItem) => ({
          id: `st-svc-${item.id}`,
          name: item.displayName || item.name || item.code,
          description: item.description || '',
          price: item.price || 0,
          category: mapServiceCategory(item.categories),
          stSkuId: item.id,
          stCode: item.code,
          stType: 'Service' as const,
        }));

        setEquipment(mappedEquipment);
        setMaterials(mappedMaterials);
        setServices(mappedServices);
      } catch (err) {
        console.error('[Pricebook] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pricebook');
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  return { equipment, materials, services, loading, error };
}

function mapMaterialCategory(categories?: Array<{ id: number; name?: string }>): string {
  if (!categories?.length) return 'misc';
  const catName = (categories[0].name || '').toLowerCase();
  if (catName.includes('electric')) return 'electrical';
  if (catName.includes('duct')) return 'ductwork';
  if (catName.includes('refriger') || catName.includes('line set')) return 'refrigerant';
  return 'materials';
}

function mapServiceCategory(categories?: Array<{ id: number; name?: string }>): string {
  if (!categories?.length) return 'comfort';
  const catName = (categories[0].name || '').toLowerCase();
  if (catName.includes('air quality') || catName.includes('iaq')) return 'indoor-air-quality';
  if (catName.includes('protect')) return 'protection';
  if (catName.includes('smart')) return 'smart-home';
  return 'comfort';
}
