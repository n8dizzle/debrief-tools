import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { formatPhoneE164 } from "@/lib/quo";

export interface RosterSyncResult {
  st_synced: number;
  st_deactivated: number;
  portal_synced: number;
  errors: string[];
}

// Sync the trainable roster into train_people. Identity is the source's stable id
// (ST technician id / portal_users id) — NEVER phone (handsets get reassigned). Phone
// is stored for SMS but is not an identity key. Departed techs (no longer active in ST)
// are marked active=false; their history is retained.
export async function syncRoster(): Promise<RosterSyncResult> {
  const supabase = getServerSupabase();
  const result: RosterSyncResult = { st_synced: 0, st_deactivated: 0, portal_synced: 0, errors: [] };

  // ---- ServiceTitan technicians ----
  const st = getServiceTitanClient();
  if (st.configured) {
    try {
      const techs = await st.getTechnicians(true);
      const { data: existing } = await supabase
        .from("train_people")
        .select("id, st_id")
        .eq("source", "servicetitan");
      const byStId = new Map<number, string>();
      for (const p of existing || []) if (p.st_id != null) byStId.set(Number(p.st_id), p.id);

      const activeStIds = new Set<number>();
      for (const t of techs) {
        activeStIds.add(t.id);
        const phone = formatPhoneE164(t.mobilePhone || t.phoneNumber || "");
        const row = {
          source: "servicetitan",
          st_id: t.id,
          name: t.name,
          phone,
          email: t.email || null,
          active: true,
          updated_at: new Date().toISOString(),
        };
        const id = byStId.get(t.id);
        if (id) {
          await supabase.from("train_people").update(row).eq("id", id);
        } else {
          await supabase.from("train_people").insert(row);
        }
        result.st_synced++;
      }

      // Deactivate techs that dropped out of the active ST set.
      for (const [stId, id] of byStId) {
        if (!activeStIds.has(stId)) {
          await supabase.from("train_people").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
          result.st_deactivated++;
        }
      }
    } catch (err) {
      result.errors.push(`ServiceTitan: ${err instanceof Error ? err.message : "error"}`);
    }
  } else {
    result.errors.push("ServiceTitan not configured");
  }

  // ---- Portal users (office/managers) ----
  try {
    const { data: portalUsers } = await supabase
      .from("portal_users")
      .select("id, name, email, role, is_active");
    const { data: existingPortal } = await supabase
      .from("train_people")
      .select("id, portal_id")
      .eq("source", "portal");
    const byPortalId = new Map<string, string>();
    for (const p of existingPortal || []) if (p.portal_id) byPortalId.set(p.portal_id, p.id);

    for (const u of portalUsers || []) {
      const row = {
        source: "portal",
        portal_id: u.id,
        name: u.name || u.email,
        email: u.email,
        title: u.role,
        active: u.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      const id = byPortalId.get(u.id);
      if (id) {
        await supabase.from("train_people").update(row).eq("id", id);
      } else {
        await supabase.from("train_people").insert(row);
      }
      result.portal_synced++;
    }
  } catch (err) {
    result.errors.push(`Portal: ${err instanceof Error ? err.message : "error"}`);
  }

  return result;
}
