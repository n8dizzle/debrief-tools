import type { ServiceCategory } from "@/lib/supabase";

/**
 * Service type options shown to the friend on /refer/[code].
 *
 * Collapsed from 9 → 5 buckets: the granular HVAC/Plumbing service-vs-
 * maintenance-vs-install distinction was more than a "curious neighbor"
 * could reasonably know about their own problem, and the precision was
 * illusory anyway — the actual reward tier is re-derived from the
 * ServiceTitan invoice at conversion via classifyActualCategory(), not
 * from the submission snapshot. Dispatch drills into specifics on the
 * callback.
 *
 * NOT_SURE is deliberate: visitors who don't know what they need shouldn't
 * feel forced to guess. Styled softer in the UI and mapped conservatively.
 */
export type ServiceType =
  | "HVAC"
  | "PLUMBING"
  | "WATER_HEATER"
  | "COMMERCIAL"
  | "NOT_SURE";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  HVAC: "Something's not right with my HVAC",
  PLUMBING: "A plumbing issue (leak, drain, fixture, etc.)",
  WATER_HEATER: "Water heater trouble or replacement",
  COMMERCIAL: "Commercial property or business",
  NOT_SURE: "Not sure yet — I just have a question",
};

const CATEGORY_MAP: Record<ServiceType, ServiceCategory> = {
  // HVAC and Plumbing default to SERVICE_CALL — the most common conversion
  // type for an inbound inquiry. If the invoice turns out to be a Maintenance
  // plan or Install, classifyActualCategory overrides this at reward time.
  HVAC: "SERVICE_CALL",
  PLUMBING: "SERVICE_CALL",
  WATER_HEATER: "REPLACEMENT",
  COMMERCIAL: "COMMERCIAL",
  NOT_SURE: "SERVICE_CALL",
};

/**
 * Best-guess service category from the user's selected service type.
 * This only drives the SUBMISSION snapshot. At conversion, the webhook
 * reclassifies from the actual ST job/invoice data.
 */
export function classifyExpectedCategory(serviceType: ServiceType): ServiceCategory {
  return CATEGORY_MAP[serviceType];
}
