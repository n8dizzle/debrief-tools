// @homework/shared property data
// Rentcast API integration for property enrichment.

import type { PropertyData } from './types';

type RentcastPropertyResponse = {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  assessorID?: string;
  legalDescription?: string;
  subdivision?: string;
  zoning?: string;
  lastSaleDate?: string;
  lastSalePrice?: number;
  priorSaleDate?: string;
  priorSalePrice?: number;
  taxAssessedValue?: number;
  taxAssessedYear?: number;
  taxAnnualAmount?: number;
  ownerName?: string;
  ownerOccupied?: boolean;
  ownerType?: string;
  parcelNumber?: string;
  apn?: string;
  taxRateArea?: string;
  taxAssessments?: Array<{
    year?: number;
    value?: number;
    land?: number;
    improvements?: number;
  }>;
  propertyTaxes?: Array<{
    year?: number;
    total?: number;
  }>;
  stories?: number;
  pool?: boolean;
  fireplace?: boolean;
  basement?: boolean;
  attic?: boolean;
  garage?: { spaces?: number; type?: string };
  heating?: { type?: string; fuel?: string };
  cooling?: { type?: string };
  construction?: { type?: string; style?: string };
  foundation?: { type?: string };
  roof?: { type?: string };
  window?: { type?: string };
  siding?: { type?: string };
  features?: {
    floorCount?: number;
    pool?: boolean;
    fireplace?: boolean;
    garageSpaces?: number;
    garageType?: string;
    heatingType?: string;
    coolingType?: string;
    roofType?: string;
    foundationType?: string;
    architectureType?: string;
    [key: string]: unknown;
  };
  owner?: {
    name?: string;
    type?: string;
    occupied?: boolean;
    mailingAddress?: {
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  };
};

/**
 * Parse address components from a formatted address string.
 */
function parseAddress(formattedAddress: string) {
  const parts = formattedAddress.split(',').map((p) => p.trim());

  const address = parts[0] || '';
  let city: string | undefined;
  let state: string | undefined;
  let zipCode: string | undefined;

  if (parts.length >= 2) {
    city = parts[1];
  }

  if (parts.length >= 3) {
    const stateZipPart = parts[2];
    const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s*(\d{5})/);
    if (stateZipMatch) {
      state = stateZipMatch[1];
      zipCode = stateZipMatch[2];
    } else {
      state = stateZipPart;
    }
  }

  return { address, city, state, zipCode };
}

/**
 * Generate deterministic mock data for testing.
 */
function generateMockData(address: string): PropertyData {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return {
    formattedAddress: address,
    yearBuilt: 1950 + (hash % 70),
    sqft: 1200 + (hash % 3000),
    beds: 2 + (hash % 4),
    baths: 1 + (hash % 3),
    lotSizeSqft: 4000 + (hash % 16000),
    stories: 1 + (hash % 2),
    propertyType: 'Single Family',
    pool: hash % 5 === 0,
    fireplace: hash % 3 === 0,
    garageSpaces: 1 + (hash % 3),
    source: 'mock',
  };
}

/**
 * Fetch property data from the Rentcast API.
 */
async function fetchFromRentcastApi(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<PropertyData | null> {
  const apiKey = process.env.NEXT_PUBLIC_RENTCAST_API_KEY;

  if (!apiKey) {
    console.log('[PropertyData] No Rentcast API key found');
    return null;
  }

  try {
    const url = new URL('https://api.rentcast.io/v1/properties');
    url.searchParams.set('address', address);
    if (city) url.searchParams.set('city', city);
    if (state) url.searchParams.set('state', state);
    if (zipCode) url.searchParams.set('zipCode', zipCode);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('[PropertyData] Rentcast API error:', response.status, response.statusText);
      return null;
    }

    const data: RentcastPropertyResponse = await response.json();
    const property = Array.isArray(data) ? data[0] : data;

    if (!property || !property.id) {
      return null;
    }

    return {
      rentcastId: property.id,
      propertyType: property.propertyType,
      formattedAddress: property.formattedAddress,
      addressLine1: property.addressLine1,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      county: property.county,
      latitude: property.latitude,
      longitude: property.longitude,
      yearBuilt: property.yearBuilt,
      sqft: property.squareFootage,
      beds: property.bedrooms,
      baths: property.bathrooms,
      lotSizeSqft: property.lotSize,
      stories: property.features?.floorCount,
      buildingStyle: property.features?.architectureType ?? property.construction?.style,
      constructionType: property.construction?.type,
      foundationType: property.features?.foundationType ?? property.foundation?.type,
      garageSpaces: property.features?.garageSpaces ?? property.garage?.spaces,
      garageType: property.features?.garageType ?? property.garage?.type,
      pool: property.features?.pool ?? property.pool,
      fireplace: property.features?.fireplace ?? property.fireplace,
      basement: property.basement,
      attic: property.attic,
      coolingType: property.features?.coolingType ?? property.cooling?.type,
      heatingType: property.features?.heatingType ?? property.heating?.type,
      heatingFuel: property.heating?.fuel,
      roofType: property.features?.roofType ?? property.roof?.type,
      windowType: property.window?.type,
      sidingType: property.siding?.type,
      assessorId: property.assessorID,
      taxAssessedValue: property.taxAssessedValue,
      taxAssessedYear: property.taxAssessedYear,
      taxAnnualAmount: property.taxAnnualAmount,
      taxRateArea: property.taxRateArea,
      taxAssessments: property.taxAssessments?.map((a) => ({
        year: a.year ?? 0,
        totalValue: a.value ?? 0,
        landValue: a.land,
        improvements: a.improvements,
      })),
      taxHistory: property.propertyTaxes?.map((t) => ({
        year: t.year ?? 0,
        amount: t.total ?? 0,
      })),
      lastSaleDate: property.lastSaleDate,
      lastSalePrice: property.lastSalePrice,
      priorSaleDate: property.priorSaleDate,
      priorSalePrice: property.priorSalePrice,
      ownerName: property.owner?.name || property.ownerName,
      ownerType: property.owner?.type || property.ownerType,
      ownerOccupied: property.owner?.occupied ?? property.ownerOccupied,
      ownerMailingAddress: property.owner?.mailingAddress?.address,
      ownerMailingCity: property.owner?.mailingAddress?.city,
      ownerMailingState: property.owner?.mailingAddress?.state,
      ownerMailingZip: property.owner?.mailingAddress?.zipCode,
      legalDescription: property.legalDescription,
      parcelNumber: property.parcelNumber,
      apn: property.apn,
      subdivision: property.subdivision,
      zoning: property.zoning,
      features: property.features,
      source: 'api',
    };
  } catch (error) {
    console.error('[PropertyData] Error fetching from Rentcast:', error);
    return null;
  }
}

/**
 * Get property data for an address.
 * Tries Rentcast API first, falls back to deterministic mock data.
 */
export async function getPropertyData(formattedAddress: string): Promise<PropertyData> {
  const { address, city, state, zipCode } = parseAddress(formattedAddress);
  const apiData = await fetchFromRentcastApi(address, city, state, zipCode);
  if (apiData) {
    return apiData;
  }

  return generateMockData(formattedAddress);
}
