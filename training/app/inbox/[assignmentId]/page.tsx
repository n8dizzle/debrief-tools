import { redirect } from "next/navigation";
import { getCurrentTech } from "@/lib/tech-auth";
import { getServerSupabase } from "@/lib/supabase";
import StepPlayer, { type ClientStep } from "./StepPlayer";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const tech = await getCurrentTech();
  if (!tech) redirect("/inbox");

  const supabase = getServerSupabase();
  const { data: assignment } = await supabase
    .from("train_assignments")
    .select("id, training_id, person_id, status")
    .eq("id", assignmentId)
    .single();
  if (!assignment || assignment.person_id !== tech.id) redirect("/inbox");

  const [{ data: training }, { data: steps }, { data: completions }] = await Promise.all([
    supabase.from("train_trainings").select("title").eq("id", assignment.training_id).single(),
    supabase.from("train_steps").select("id, order_index, type, required, config").eq("training_id", assignment.training_id).order("order_index"),
    supabase.from("train_step_completions").select("step_id").eq("assignment_id", assignmentId),
  ]);

  // SECURITY: strip the quiz answer key before it ever reaches the browser.
  const clientSteps: ClientStep[] = (steps || []).map((s) => {
    const cfg = (s.config || {}) as Record<string, unknown>;
    if (s.type === "quiz") {
      const questions = ((cfg.questions as Array<{ prompt: string; choices: string[] }>) || [])
        .map((q) => ({ prompt: q.prompt, choices: q.choices }));
      return { id: s.id, type: s.type, config: { questions, pass_threshold: cfg.pass_threshold ?? 80 } };
    }
    return { id: s.id, type: s.type, config: cfg };
  });

  const doneIds = (completions || []).map((c) => c.step_id);

  return (
    <StepPlayer
      assignmentId={assignmentId}
      trainingTitle={training?.title || "Training"}
      steps={clientSteps}
      completedStepIds={doneIds}
      alreadyComplete={assignment.status === "completed"}
    />
  );
}
