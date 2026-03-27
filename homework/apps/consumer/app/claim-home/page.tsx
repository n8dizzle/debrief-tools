import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClaimHomeClient } from "./claim-home-client"

/**
 * Protected route for claiming a home after authentication
 * User must be authenticated to access this page
 */
export default async function ClaimHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be authenticated (middleware should handle this, but double-check)
  if (!user) {
    redirect("/login?next=/claim-home")
  }

  return <ClaimHomeClient />
}
