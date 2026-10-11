import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BookOpen, Check, Copy, Download, ListChecks, Phone, RotateCcw, Volume2 } from "lucide-react";
import { capturedCount, formatINR, handleUtterance, initialState, openingLine, simulate } from "@/lib/lap/engine";
import { PROMPT_TEMPLATE, renderPrompt } from "@/lib/lap/prompt";
import { OUTCOME_LABEL, SCENARIOS, type Scenario } from "@/lib/lap/scenarios";
import { speakLine } from "@/lib/lap/speak";
import {
  DEFAULT_RAG,
  type CallProfile,
  type EndReason,
  type Gender,
  type Language,
  type QualState,
} from "@/lib/lap/types";

type View = "call" | "prompt" | "lab" | "approach";

interface Line {
  role: "agent" | "customer";
  text: string;
}

const LINKS_KEY = "qualify-desk-links-v1";

function clockLabels() {
  const d = new Date();
  return {
    dateLabel: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    dayLabel: d.toLocaleDateString("en-IN", { weekday: "long" }),
    timeLabel: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function outcomeTone(reason: EndReason | null): string {
  if (reason === "handoff") return "bg-good-soft text-good";
  if (reason === "disqualified" || reason === "declined_cap" || reason === "wrong_number") return "bg-rose-soft text-rose";
  if (reason === "transfer" || reason === "callback" || reason === "not_interested") return "bg-brass-soft text-brass";
  return "bg-agent text-teal-deep";
}

export function Desk() {
  const [view, setView] = useState<View>("call");
  const [labels, setLabels] = useState({ dateLabel: "—", dayLabel: "—", timeLabel: "—" });
  const [companyName, setCompanyName] = useState("Home Credit");
  const [customerName, setCustomerName] = useState("Rahul Sharma");
  const [agentName, setAgentName] = useState("Ananya");
  const [agentGender, setAgentGender] = useState<Gender>("female");
  const [language, setLanguage] = useState<Language>("English");
  const [rag, setRag] = useState(DEFAULT_RAG);
  const [filledPrompt, setFilledPrompt] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [state, setState] = useState<QualState>(() => initialState());
  const [lines, setLines] = useState<Line[]>(() => [
    {
      role: "agent",
      text: openingLine({
        companyName: "Home Credit",
        customerName: "Rahul Sharma",
        agentName: "Ananya",
        agentGender: "female",
        language: "English",
        rag: DEFAULT_RAG,
        dateLabel: "",
        dayLabel: "",
        timeLabel: "",
      }),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [speakError, setSpeakError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const profile: CallProfile = {
    companyName: companyName.trim() || "Home Credit",
    customerName: customerName.trim() || "Rahul Sharma",
    agentName: agentName.trim() || "Ananya",
    agentGender,
    language,
    rag,
    ...labels,
  };

  useEffect(() => {
    setLabels(clockLabels());
    try {
      const raw = localStorage.getItem(LINKS_KEY);
      if (raw) setLinks(JSON.parse(raw) as Record<string, string>);
    } catch {
      /* ignore broken local notes */
    }
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, view]);

  function resetCall() {
    setState(initialState());
    setLines([{ role: "agent", text: openingLine(profile) }]);
    setDraft("");
    setSpeakError(null);
  }

  function send(text: string) {
    const utterance = text.trim();
    if (!utterance || state.stage === "ended") return;
    const result = handleUtterance(state, utterance, profile);
    setState(result.state);
    setLines((prev) => [...prev, { role: "customer", text: utterance }, { role: "agent", text: result.reply }]);
    setDraft("");
  }

  function loadScenario(scenario: Scenario) {
    const run = simulate(profile, scenario.turns);
    setState(run.state);
    setLines(run.lines);
    setView("call");
    setDraft("");
  }

  async function listen(index: number, text: string) {
    setSpeakError(null);
    setSpeaking(index);
    try {
      const result = await speakLine({ data: { text, gender: profile.agentGender, language: profile.language } });
      if (!result.ok) {
        setSpeakError(result.error);
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(`data:${result.mime};base64,${result.audioBase64}`);
      audioRef.current = audio;
      await audio.play();
    } catch {
      setSpeakError("Couldn't speak that line. Try again in a moment.");
    } finally {
      setSpeaking(null);
    }
  }

  async function onCopy(id: string, text: string) {
    await copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const promptText = filledPrompt
    ? renderPrompt({
        companyName: profile.companyName,
        customerName: profile.customerName,
        agentName: profile.agentName,
        agentGender: profile.agentGender,
        language: profile.language,
        dateLabel: profile.dateLabel,
        dayLabel: profile.dayLabel,
        timeLabel: profile.timeLabel,
        rag: profile.rag,
      })
    : PROMPT_TEMPLATE;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-teal uppercase">Home Credit · LAP</p>
              <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Qualify Desk</h1>
              <p className="mt-1 max-w-xl text-sm text-muted">
                System prompt, rule rehearsal, and transcripts for the Loan Against Property voice agent.
              </p>
            </div>
            <Phone className="mt-1 hidden size-8 text-teal sm:block" aria-hidden="true" />
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Sections">
            <Tab current={view} id="call" onSelect={setView} icon={<Phone className="size-4" aria-hidden="true" />} label="Call floor" />
            <Tab current={view} id="prompt" onSelect={setView} icon={<Copy className="size-4" aria-hidden="true" />} label="System prompt" />
            <Tab current={view} id="lab" onSelect={setView} icon={<ListChecks className="size-4" aria-hidden="true" />} label="Scenarios" />
            <Tab current={view} id="approach" onSelect={setView} icon={<BookOpen className="size-4" aria-hidden="true" />} label="Approach" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6">
        {view === "call" && (
          <CallFloor
            profile={profile}
            state={state}
            lines={lines}
            draft={draft}
            setDraft={setDraft}
            send={send}
            reset={resetCall}
            listen={listen}
            speaking={speaking}
            speakError={speakError}
            threadRef={threadRef}
            setCompanyName={setCompanyName}
            setCustomerName={setCustomerName}
            setAgentName={setAgentName}
            setAgentGender={setAgentGender}
            setLanguage={setLanguage}
            loadScenario={loadScenario}
          />
        )}
        {view === "prompt" && (
          <PromptView
            text={promptText}
            filled={filledPrompt}
            setFilled={setFilledPrompt}
            copied={copied === "prompt"}
            onCopy={() => onCopy("prompt", promptText)}
            onDownload={() => downloadText("home-credit-lap-system-prompt.txt", promptText)}
            rag={rag}
            setRag={setRag}
          />
        )}
        {view === "lab" && (
          <LabView
            profile={profile}
            links={links}
            setLinks={(next) => {
              setLinks(next);
              localStorage.setItem(LINKS_KEY, JSON.stringify(next));
            }}
            onOpen={loadScenario}
            onDownload={() => downloadText("lap-scenario-transcripts.md", buildTranscriptPack(profile))}
          />
        )}
        {view === "approach" && <ApproachView onDownload={() => downloadText("lap-approach.md", APPROACH_MD)} />}
      </main>
    </div>
  );
}

function Tab({
  current,
  id,
  onSelect,
  icon,
  label,
}: {
  current: View;
  id: View;
  onSelect: (id: View) => void;
  icon: ReactNode;
  label: string;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={"inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold " + (active ? "bg-teal text-card" : "bg-paper text-ink")}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function CallFloor({
  profile,
  state,
  lines,
  draft,
  setDraft,
  send,
  reset,
  listen,
  speaking,
  speakError,
  threadRef,
  setCompanyName,
  setCustomerName,
  setAgentName,
  setAgentGender,
  setLanguage,
  loadScenario,
}: {
  profile: CallProfile;
  state: QualState;
  lines: Line[];
  draft: string;
  setDraft: (v: string) => void;
  send: (text: string) => void;
  reset: () => void;
  listen: (index: number, text: string) => void;
  speaking: number | null;
  speakError: string | null;
  threadRef: RefObject<HTMLDivElement | null>;
  setCompanyName: (v: string) => void;
  setCustomerName: (v: string) => void;
  setAgentName: (v: string) => void;
  setAgentGender: (v: Gender) => void;
  setLanguage: (v: Language) => void;
  loadScenario: (s: Scenario) => void;
}) {
  const ended = state.stage === "ended";
  const first = profile.customerName.split(" ")[0] || profile.customerName;
  const chips = [
    `Yes, this is ${first}.`,
    "I'm in a meeting.",
    "Yes, go ahead.",
    "It's a residential house worth about 1.2 crore, jointly owned with my wife.",
    "I already have a loan on this property.",
    "What's the interest rate?",
    "I need 90 lakh.",
    "It's agricultural land.",
  ];

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-w-0 min-h-[70vh] flex-col rounded-lg border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Outbound</p>
            <p className="font-medium">
              {profile.agentName} → {profile.customerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={"rounded-full px-3 py-1 text-xs font-semibold " + outcomeTone(state.endReason)}>
              {state.endReason ? OUTCOME_LABEL[state.endReason] : "On the call"}
            </span>
            <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-teal">
              <RotateCcw className="size-4" aria-hidden="true" />
              New call
            </button>
          </div>
        </div>
        <details className="border-b border-line px-4 py-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">Call setup</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Company" value={profile.companyName} onChange={setCompanyName} />
            <Field label="Customer" value={profile.customerName} onChange={setCustomerName} />
            <Field label="Agent" value={profile.agentName} onChange={setAgentName} />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Gender</span>
              <select
                value={profile.agentGender}
                onChange={(e) => setAgentGender(e.target.value as Gender)}
                className="min-h-11 rounded-lg border border-line bg-paper px-3"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Language</span>
              <select
                value={profile.language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="min-h-11 rounded-lg border border-line bg-paper px-3"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </label>
            <p className="self-end text-sm text-muted">
              {profile.dayLabel}, {profile.dateLabel} · {profile.timeLabel}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted">Press New call after editing names so the greeting uses them. Later replies already follow gender and language.</p>
        </details>
        <div ref={threadRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {lines.map((line, i) => (
            <div key={`${i}-${line.role}`} className={line.role === "agent" ? "max-w-[40rem] self-start" : "max-w-[40rem] self-end"}>
              <p className="mb-1 text-xs font-semibold text-muted">{line.role === "agent" ? profile.agentName : profile.customerName}</p>
              <div className={"rounded-lg px-3 py-2 text-sm leading-relaxed " + (line.role === "agent" ? "bg-agent text-ink" : "bg-ink text-card")}>
                {line.text}
              </div>
              {line.role === "agent" && (
                <button
                  type="button"
                  onClick={() => listen(i, line.text)}
                  disabled={speaking !== null}
                  className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-teal disabled:opacity-50"
                >
                  <Volume2 className="size-3.5" aria-hidden="true" />
                  {speaking === i ? "Speaking…" : "Listen"}
                </button>
              )}
            </div>
          ))}
        </div>
        {speakError && <p className="px-4 pb-2 text-sm text-rose">{speakError}</p>}
        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 flex max-w-full gap-2 overflow-x-auto">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={ended}
                onClick={() => send(chip)}
                className="min-h-11 shrink-0 rounded-full border border-line px-3 text-xs font-medium disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label className="sr-only" htmlFor="utterance">
              What the customer says
            </label>
            <input
              id="utterance"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={ended}
              placeholder={ended ? "This call has ended" : "Speak as the customer…"}
              className="min-h-11 flex-1 rounded-lg border border-line bg-paper px-3 text-sm"
            />
            <button type="submit" disabled={ended || !draft.trim()} className="min-h-11 rounded-lg bg-teal px-4 text-sm font-semibold text-card disabled:opacity-40">
              Send
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            This floor follows the eligibility rules exactly, so you can rehearse before you record on Retell or Bolna. Listen is a read-aloud of the line — not the graded call recording.
          </p>
        </div>
      </section>
      <StateBoard state={state} onLoad={loadScenario} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-lg border border-line bg-paper px-3" />
    </label>
  );
}

function StatusRow({ ok, label, value }: { ok: boolean | null; label: string; value: string }) {
  const tone = ok == null ? "bg-paper text-muted" : ok ? "bg-good-soft text-good" : "bg-rose-soft text-rose";
  const mark = ok == null ? "Open" : ok ? "Pass" : "Fail";
  return (
    <li className="grid grid-cols-[4.5rem_1fr] items-start gap-2 border-b border-line py-2 last:border-b-0">
      <span className={"mt-0.5 w-fit rounded-full px-2 py-0.5 text-xs font-semibold " + tone}>{mark}</span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted">{value}</p>
      </div>
    </li>
  );
}

function StateBoard({ state, onLoad }: { state: QualState; onLoad: (s: Scenario) => void }) {
  const propertyOk = state.propertyType == null ? null : state.propertyType !== "agricultural";
  const docsOk = state.documents == null ? null : state.documents === "available";
  const loanOk = state.loanAmount == null ? null : state.loanAmount <= 7_500_000;
  const incomeOk =
    state.occupation == null && state.incomeMode == null ? null : state.incomeMode === "cash" ? false : state.occupation != null && state.incomeMode === "bank";
  const tenureOk = state.tenureYears == null ? null : state.tenureYears >= 3 && state.tenureYears <= 15;

  return (
    <aside className="space-y-4">
      <div className="rounded-lg border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Checklist</h2>
          <p className="text-sm text-muted tabular-nums">{capturedCount(state)} of 7</p>
        </div>
        <ol className="mt-2">
          <StatusRow ok={propertyOk} label="1 · Property" value={state.propertyType ?? "Not captured"} />
          <StatusRow ok={state.ownership == null ? null : true} label="2 · Ownership" value={state.ownership ?? "Not captured"} />
          <StatusRow ok={docsOk} label="3 · Originals" value={state.documents ?? "Not captured"} />
          <StatusRow ok={loanOk} label="4 · Loan amount" value={state.loanAmount == null ? "Not captured" : formatINR(state.loanAmount)} />
          <StatusRow
            ok={incomeOk}
            label="5 · Work & income"
            value={[state.occupation ?? "Work unknown", state.incomeMode ?? "Mode unknown"].join(" · ")}
          />
          <StatusRow ok={state.marketValue == null ? null : true} label="6 · Market value" value={state.marketValue == null ? "Not captured" : formatINR(state.marketValue)} />
          <StatusRow ok={tenureOk} label="7 · Tenure" value={state.tenureYears == null ? "Not captured" : `${state.tenureYears} years`} />
        </ol>
        {state.disqualifyReason && <p className="mt-3 text-sm text-rose">Stopped: {state.disqualifyReason}</p>}
        {state.transferReason && (
          <p className="mt-3 text-sm text-brass">Transfer: {state.transferReason === "emi" ? "EMI reduction" : "Existing loan"}</p>
        )}
        {state.callbackTime && <p className="mt-3 text-sm text-muted">Callback: {state.callbackTime}</p>}
      </div>
      <div className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-display text-xl font-semibold">Jump to a case</h2>
        <ul className="mt-2 space-y-1">
          {SCENARIOS.slice(0, 8).map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onLoad(s)} className="min-h-11 w-full rounded-lg px-2 text-left text-sm hover:bg-paper">
                <span className="font-medium">{s.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{OUTCOME_LABEL[s.expect]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function PromptView({
  text,
  filled,
  setFilled,
  copied,
  onCopy,
  onDownload,
  rag,
  setRag,
}: {
  text: string;
  filled: boolean;
  setFilled: (v: boolean) => void;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  rag: string;
  setRag: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-lg border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">System prompt</h2>
            <p className="text-sm text-muted">Paste this into Retell, Bolna, or a similar voice agent. Map the double-brace variables to the platform fields.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCopy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-semibold text-card">
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold">
              <Download className="size-4" aria-hidden="true" />
              Download
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setFilled(false)} className={"min-h-11 rounded-full px-4 text-sm font-semibold " + (!filled ? "bg-ink text-card" : "bg-paper")}>
            With variables
          </button>
          <button type="button" onClick={() => setFilled(true)} className={"min-h-11 rounded-full px-4 text-sm font-semibold " + (filled ? "bg-ink text-card" : "bg-paper")}>
            Filled sample
          </button>
        </div>
        <pre className="max-h-[70vh] overflow-auto px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap">{text}</pre>
      </section>
      <aside className="space-y-4">
        <div className="rounded-lg border border-line bg-card p-4">
          <h3 className="font-display text-xl font-semibold">Platform checklist</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-muted">
            <li>Create an agent on Retell, Bolna, or similar.</li>
            <li>Paste the variable version of this prompt.</li>
            <li>Bind company, customer, agent name, agent gender, the date fields, language, and the RAG note.</li>
            <li>Pick a voice that matches the agent gender.</li>
            <li>Run the scenarios out loud and save the public recording links.</li>
          </ol>
        </div>
        <label className="block rounded-lg border border-line bg-card p-4 text-sm">
          <span className="font-semibold">Sample RAG note</span>
          <span className="mt-1 block text-muted">Used in the filled preview. The agent may not invent facts outside this note and the written rules.</span>
          <textarea value={rag} onChange={(e) => setRag(e.target.value)} rows={10} className="mt-3 w-full rounded-lg border border-line bg-paper p-3" />
        </label>
      </aside>
    </div>
  );
}

function LabView({
  profile,
  links,
  setLinks,
  onOpen,
  onDownload,
}: {
  profile: CallProfile;
  links: Record<string, string>;
  setLinks: (v: Record<string, string>) => void;
  onOpen: (s: Scenario) => void;
  onDownload: () => void;
}) {
  const runs = SCENARIOS.map((scenario) => {
    const run = simulate(profile, scenario.turns);
    const actual: EndReason | "open" = run.state.endReason ?? "open";
    return { scenario, run, pass: actual === scenario.expect, actual };
  });
  const passed = runs.filter((r) => r.pass).length;
  const [openId, setOpenId] = useState(SCENARIOS[0]?.id ?? "");
  const selected = runs.find((r) => r.scenario.id === openId) ?? runs[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold tabular-nums">
            {passed} of {runs.length} match
          </p>
          <button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal">
            <Download className="size-4" aria-hidden="true" />
            Transcripts
          </button>
        </div>
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
          {runs.map(({ scenario, pass }) => (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => setOpenId(scenario.id)}
                className={
                  "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm " +
                  (scenario.id === selected?.scenario.id ? "bg-card ring-1 ring-line" : "hover:bg-card")
                }
              >
                <span>
                  <span className="block font-medium">{scenario.title}</span>
                  <span className="text-xs text-muted">{scenario.group}</span>
                </span>
                <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + (pass ? "bg-good-soft text-good" : "bg-rose-soft text-rose")}>
                  {pass ? "Pass" : "Check"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selected && (
        <article className="rounded-lg border border-line bg-card p-4 sm:p-6">
          <p className="text-xs font-semibold tracking-wide text-teal uppercase">{selected.scenario.group}</p>
          <h2 className="font-display text-2xl font-semibold">{selected.scenario.title}</h2>
          <p className="mt-2 text-sm text-muted">{selected.scenario.why}</p>
          <p className="mt-3 text-sm">
            Expected <span className="font-semibold">{OUTCOME_LABEL[selected.scenario.expect]}</span>
            {" · "}
            Reference <span className="font-semibold">{OUTCOME_LABEL[selected.actual]}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpen(selected.scenario)} className="min-h-11 rounded-lg bg-teal px-4 text-sm font-semibold text-card">
              Open on the call floor
            </button>
            <button
              type="button"
              onClick={() => downloadText(`${selected.scenario.id}-transcript.md`, formatRun(profile, selected.scenario, selected.run.lines))}
              className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold"
            >
              Download this transcript
            </button>
          </div>
          <ol className="mt-5 space-y-3">
            {selected.run.lines.map((line, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <span className="font-semibold">{line.role === "agent" ? profile.agentName : profile.customerName}. </span>
                {line.text}
              </li>
            ))}
          </ol>
          <label className="mt-6 block text-sm">
            <span className="font-semibold">Public recording link</span>
            <span className="mt-1 block text-muted">Paste the Retell or Bolna link after you record this case. Saved in this browser only.</span>
            <input
              value={links[selected.scenario.id] ?? ""}
              onChange={(e) => setLinks({ ...links, [selected.scenario.id]: e.target.value })}
              placeholder="https://"
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-paper px-3"
            />
          </label>
        </article>
      )}
    </div>
  );
}

function ApproachView({ onDownload }: { onDownload: () => void }) {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-teal uppercase">Optional write-up</p>
          <h2 className="font-display text-3xl font-semibold">How the call is built</h2>
        </div>
        <button type="button" onClick={onDownload} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-semibold">
          <Download className="size-4" aria-hidden="true" />
          Download
        </button>
      </div>
      <div className="mt-6 space-y-4 text-sm leading-relaxed sm:text-base">
        <p>
          The hard part is not asking seven questions in order. It is keeping a silent file, taking facts whenever the customer offers them, and stopping the moment a rule fails.
        </p>
        <p>Every customer turn runs the same four steps: extract, validate, update, then ask only the earliest missing item.</p>
        <h3 className="font-display text-2xl font-semibold">Rules that are easy to get wrong</h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Check</th>
                <th className="px-3 py-2 font-semibold">Eligible</th>
                <th className="px-3 py-2 font-semibold">Stop</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Property", "Residential, commercial, industrial", "Agricultural — immediate"],
                ["Ownership", "Sole and joint", "Neither is a fail"],
                ["Documents", "Originals available, even at home", "Copies only, or none"],
                ["Amount", "Up to ₹75 lakh", "Above 75: offer 75, end only if they refuse"],
                ["Income", "Salaried or self-employed, via bank", "Cash — immediate"],
                ["Value", "Whatever they estimate", "No minimum in the brief"],
                ["Tenure", "3 to 15 years", "Outside that — immediate, no rescue offer"],
              ].map((cells) => (
                <tr key={cells[0]} className="border-b border-line last:border-b-0">
                  {cells.map((cell) => (
                    <td key={cell} className="px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          An existing loan on the property, or a request to reduce the current EMI, leaves the fresh-loan script. The close is a loan-transfer specialist, then the call ends. Saying there is no existing loan stays on the fresh-loan path.
        </p>
        <p>
          Busy customers never hear the pitch. The agent asks for a callback time and stops. Identity is a gate: until the named customer is confirmed, the agent does not quote ₹75 lakh.
        </p>
        <p>
          Side questions get one sentence from the product note, or a plain refusal if the note doesn't have the fact. Interest rates are not invented. The senior loan expert owns the rate, and that handoff is allowed only after all seven answers are in.
        </p>
        <h3 className="font-display text-2xl font-semibold">What to submit</h3>
        <p>
          Submit the system prompt from the Prompt tab. Record the scenarios on a voice platform — Retell and Bolna both have trials — with a voice that matches the agent gender and the language in language_to_speak. Paste each public recording link beside its scenario. The transcripts here are the reference behaviour of the rules; attach the platform transcript with the audio.
        </p>
        <p>
          The call floor is a deterministic rehearsal of those rules, so a practice call cannot drift from the brief. The prompt is what the voice model should follow when you record for real.
        </p>
      </div>
    </article>
  );
}

function formatRun(profile: CallProfile, scenario: Scenario, lines: Line[]) {
  const body = lines.map((l) => `**${l.role === "agent" ? profile.agentName : profile.customerName}:** ${l.text}`).join("\n\n");
  return `# ${scenario.title}\n\nExpected: ${OUTCOME_LABEL[scenario.expect]}\n\n${scenario.why}\n\n${body}\n`;
}

function buildTranscriptPack(profile: CallProfile) {
  return SCENARIOS.map((scenario) => formatRun(profile, scenario, simulate(profile, scenario.turns).lines)).join("\n---\n\n");
}

const APPROACH_MD = `# Qualify Desk — approach

The agent is a preliminary qualifier for Home Credit's Loan Against Property offer, not the sanctioning officer.

Every customer turn follows four steps: extract every fact, validate against the stop rules, update silent state, ask only the earliest missing checklist item.

Stop immediately for agricultural property, missing original documents, cash income, or tenure outside 3–15 years. Joint ownership is eligible. There is no minimum market value. A request above ₹75 lakh is negotiated down to ₹75 lakh once; a refusal ends the call.

An existing property loan or an EMI-reduction request switches to the loan-transfer specialist and ends. A busy customer gets a callback time and no pitch. The senior-expert handoff happens only after all seven answers are in.

Do not invent interest rates, fees, branches, or a property-value floor. Product colour comes only from additional_context_from_rag.

Record the prompt on Retell, Bolna, or similar. Use the scenario transcripts as the rehearsal script.
`;
