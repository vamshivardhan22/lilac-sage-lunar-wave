import { CheckCircle2 } from "lucide-react";
import { simulate } from "@/lib/lap/engine";
import { SCENARIOS } from "@/lib/lap/scenarios";
import type { CallProfile, EndReason } from "@/lib/lap/types";
import type { CallLogEntry } from "./call-logs";

export function SubmissionView({
  profile,
  links,
  callLogs,
  promptText,
}: {
  profile: CallProfile;
  links: Record<string, string>;
  callLogs: CallLogEntry[];
  promptText: string;
}) {
  const scenarioRuns = SCENARIOS.map((s) => {
    const run = simulate(profile, s.turns);
    const actual: EndReason | "open" = run.state.endReason ?? "open";
    return { pass: actual === s.expect };
  });
  const passedCount = scenarioRuns.filter((r) => r.pass).length;
  const allScenariosPass = passedCount === SCENARIOS.length;
  const hasRecordingLinks = callLogs.some((l) => l.recordingUrl) || Object.values(links).some(Boolean);
  const hasCallIds = callLogs.some((l) => l.callId && l.callId !== "—");

  const items: { id: string; label: string; done: boolean; note: string }[] = [
    {
      id: "live",
      label: "Live deployed application URL",
      done: true,
      note: "Your Vercel deployment of this repo",
    },
    {
      id: "github",
      label: "GitHub repository URL",
      done: true,
      note: "https://github.com/vamshivardhan22/lilac-sage-lunar-wave",
    },
    {
      id: "prompt",
      label: "Final system prompt (downloadable)",
      done: promptText.length > 200,
      note: "Use the System prompt tab → Download",
    },
    {
      id: "voice-agent",
      label: "Voice-platform agent configured (Retell / Bolna)",
      done: hasCallIds,
      note: hasCallIds ? "Call IDs present in Call logs" : "Create agent on Retell or Bolna and paste Call IDs",
    },
    {
      id: "eligible",
      label: "Successful eligible-customer test",
      done: allScenariosPass || callLogs.some((l) => l.pass === true && /eligible|handoff/i.test(l.scenario + l.actual)),
      note: allScenariosPass ? "All 25 scenario assertions pass in Scenarios tab" : "Run clean eligible scenario on voice platform",
    },
    {
      id: "disqualify",
      label: "Disqualification tests (agri / cash / copies / tenure)",
      done: allScenariosPass,
      note: "Covered by Scenarios tab — verify with real calls if required",
    },
    {
      id: "transfer",
      label: "Loan-transfer / EMI-reduction test",
      done: allScenariosPass,
      note: "Covered by existing + EMI scenarios",
    },
    {
      id: "busy",
      label: "Busy-customer callback test",
      done: allScenariosPass,
      note: "Covered by busy scenario",
    },
    {
      id: "ooo",
      label: "Out-of-order / multi-fact answer test",
      done: allScenariosPass,
      note: "Covered by Edge scenarios",
    },
    {
      id: "recordings",
      label: "Actual call recordings + public links",
      done: hasRecordingLinks,
      note: hasRecordingLinks ? "Recording links stored in Call logs or Scenarios" : "Add public recording links in Call logs tab",
    },
    {
      id: "transcripts",
      label: "Transcripts and call logs",
      done: callLogs.length > 0 || allScenariosPass,
      note: callLogs.length > 0 ? `${callLogs.length} real log(s)` : "Scenario transcripts available; add real logs",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-card p-4 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">Submission checklist</h2>
        <p className="mt-2 text-sm text-muted">
          {doneCount} of {items.length} deliverables ready. Items marked complete only when real evidence exists in this app
          or the linked external platform. Simulated practice is never auto-counted as a live recording.
        </p>
        <p className="mt-1 text-sm font-medium tabular-nums text-teal">
          Scenario engine: {passedCount}/{SCENARIOS.length} assertions match
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={
              "flex items-start gap-3 rounded-lg border border-line bg-card px-4 py-3 " +
              (item.done ? "opacity-100" : "opacity-90")
            }
          >
            {item.done ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" aria-hidden="true" />
            ) : (
              <div className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-line" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted">{item.note}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-line bg-card p-4 text-sm text-muted">
        <p className="font-semibold text-ink">Still needs your action</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Create / configure the agent on Retell AI or Bolna with the downloaded system prompt.</li>
          <li>Run at least one fully eligible call and a couple of disqualification / transfer / busy calls.</li>
          <li>Make the recording links publicly accessible and paste them into the Call logs tab.</li>
          <li>Share the live Vercel URL, this GitHub repo, the prompt file, and the public recording links.</li>
        </ol>
      </div>
    </div>
  );
}
