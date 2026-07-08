# TODOS

Deferred work captured during planning/review. Each entry: what, why, context, dependencies.

## Training System (training.christmasair.com)

### Promote `quo.ts` + ServiceTitan technician client into `packages/shared`
- **What:** Move the Quo SMS utility and the ServiceTitan technician-fetch client out of
  per-app `lib/` copies into `@christmas-air/shared`.
- **Why:** Both are now copy-pasted across ap-payments, service-dashboard, ar-collections,
  and (incoming) training. The Quo provider migration (OpenPhone → Quo) had to touch every
  app — that's the cost of the duplication, felt directly.
- **Pros:** One place to change the SMS provider or ST auth; new apps import instead of copy.
- **Cons:** Shared-package churn risk; needs a version bump discipline across consumers.
- **Context:** `ap-payments/lib/quo.ts` is stable and dependency-free (uses `fetch`). The ST
  client `getTechnicians()` lives in `ap-payments/lib/servicetitan.ts:303`. Do this AFTER
  training ships Phase 1 (don't block the new app on a refactor).
- **Depends on:** nothing blocking; best done once training is a third+ consumer.

### Investigate Quo delivery-status webhooks
- **What:** Determine whether Quo exposes delivery-status callbacks; if so, wire an inbound
  webhook to mark training texts delivered/failed precisely.
- **Why:** `quo.ts` is send-only today, so "undeliverable" detection is a soft heuristic
  (0 taps in 5 days). Real webhooks would replace the noisy badge with precise state.
- **Pros:** Accurate deliverability; kills manager time chasing false "unreachable" flags.
- **Cons:** New public inbound endpoint + signature verification; depends on a Quo feature
  we haven't confirmed exists.
- **Context:** Ties to the training delivery-status design. Also the natural home for
  handling inbound STOP/opt-out replies on the shared number (+14694054121).
- **Depends on:** confirming Quo webhook support.

### HR/legal sign-off on the electronic-signature bar
- **What:** Confirm that SMS-OTP step-up + typed legal name + drawn signature + timestamp/IP
  is legally sufficient for the policy documents Christmas Air will require techs to sign.
- **Why:** Training Phase 2 (signatures) is gated on this. If it's not sufficient, we route
  those documents through a dedicated e-sign vendor instead of building the in-house flow.
- **Pros:** Avoids building a signature flow that legal later rejects (rework).
- **Cons:** External dependency (HR/legal timeline).
- **Context:** Design open question Q4. Schema is being built to support OTP either way, so
  this only gates the signature-step UI, not the data model.
- **Depends on:** HR/legal review. Must resolve BEFORE Training Phase 2.
