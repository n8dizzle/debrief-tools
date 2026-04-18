import type { ServiceCategory } from "@/lib/supabase";

/**
 * Service type options shown to the friend on /refer/[code].
 * Drives the expected ServiceCategory snapshot at submission time.
 * Actual category is re-classified from ST job/invoice data at conversion.
 */
export type ServiceType =
  | "HVAC_SERVICE_CALL"
  | "HVAC_MAINTENANCE"
  | "HVAC_INSTALLATION"
  | "PLUMBING_SERVICE_CALL"
  | "PLUMBING_MAINTENANCE"
  | "PLUMBING_INSTALLATION"
  | "WATER_HEATER"
  | "COMMERCIAL"
  | "OTHER";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  HVAC_SERVICE_CALL: "HVAC repair / not cooling / not heating",
  HVAC_MAINTENANCE: "HVAC tune-up or maintenance plan",
  HVAC_INSTALLATION: "New HVAC system or replacement",
  PLUMBING_SERVICE_CALL: "Plumbing repair / leak / drain",
  PLUMBING_MAINTENANCE: "Plumbing inspection / maintenance",
  PLUMBING_INSTALLATION: "New fixtures or re-piping",
  WATER_HEATER: "Water heater (repair or replace)",
  COMMERCIAL: "Commercial property / business",
  OTHER: "Something else",
};

const CATEGORY_MAP: Record<ServiceType, ServiceCategory> = {
  HVAC_SERVICE_CALL: "SERVICE_CALL",
  HVAC_MAINTENANCE: "MAINTENANCE",
  HVAC_INSTALLATION: "REPLACEMENT",
  PLUMBING_SERVICE_CALL: "SERVICE_CALL",
  PLUMBING_MAINTENANCE: "MAINTENANCE",
  PLUMBING_INSTALLATION: "REPLACEMENT",
  WATER_HEATER: "REPLACEMENT",
  COMMERCIAL: "COMMERCIAL",
  OTHER: "SERVICE_CALL",
};

/**
 * Best-guess service category from the user's selected service type.
 * This only drives the SUBMISSION snapshot. At conversion, the webhook
 * reclassifies from the actual ST job/invoice data.
 */
export function classifyExpectedCategory(serviceType: ServiceType): ServiceCategory {
  return CATEGORY_MAP[serviceType];
}
