import type { ServiceCategory, Referral } from "@/lib/supabase";
import type { STJob, STInvoice } from "@/lib/servicetitan";

/**
 * Classify actual service category at conversion time from ST job + invoice data.
 *
 * Per spec §5.3:
 * - Commercial jobs → COMMERCIAL (overrides everything)
 * - Maintenance plan / membership jobs → MAINTENANCE
 * - Install/replacement jobs with invoice >= $3K → REPLACEMENT
 * - Everything else → SERVICE_CALL
 */
export function classifyActualCategory(
  job: STJob | null,
  invoice: STInvoice | null
): ServiceCategory {
  const jobType = (job?.jobTypeName || "").toLowerCase();
  const buName = (job?.businessUnitName || "").toLowerCase();
  const total = invoice?.total ?? job?.total ?? 0;

  if (jobType.includes("commercial") || buName.includes("commercial")) {
    return "COMMERCIAL";
  }

  if (
    jobType.includes("membership") ||
    jobType.includes("maintenance plan") ||
    jobType.includes("tune-up") ||
    jobType.includes("tune up")
  ) {
    return "MAINTENANCE";
  }

  if (
    total >= 3000 &&
    (jobType.includes("install") ||
      jobType.includes("replacement") ||
      jobType.includes("replace"))
  ) {
    return "REPLACEMENT";
  }

  return "SERVICE_CALL";
}

/**
 * Whether the referral's snapshotted category matches the actual classification.
 * If not, we need to pull a fresh tier from the same config.
 */
export function snapshotCategoryMatches(
  referral: Referral,
  actualCategory: ServiceCategory
): boolean {
  const snap = referral.snapshot_tier_json;
  if (!snap || typeof snap !== "object") return false;
  const snapCategory = (snap as { serviceCategory?: string }).serviceCategory;
  return snapCategory === actualCategory;
}
