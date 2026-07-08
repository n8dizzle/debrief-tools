import { Suspense } from "react";
import SpikeTrainingClient from "./SpikeTrainingClient";

// PUBLIC route (excluded from SSO in middleware). This is the tech-facing
// Phase 0 spike: a dummy one-page "training" reached via a texted link
// (/train?t=<token>). Its only job is to measure tap-through and completion.
export default function TrainPage() {
  return (
    <Suspense fallback={null}>
      <SpikeTrainingClient />
    </Suspense>
  );
}
