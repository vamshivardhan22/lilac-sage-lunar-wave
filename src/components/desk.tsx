import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  History,
  ListChecks,
  Phone,
  RotateCcw,
  Volume2,
} from "lucide-react";
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

type View = "call" | "prompt" | "lab" | "approach" | "logs" | "submit";

interface Line {
  role: "agent" | "customer";
  text: string;
}

interface CallLogEntry {
  id: string;
  callId: string;
  scenario: string;
  timestamp: string;
  status: string;
  duration: string;
  recordingUrl: string;
  transcript: string;
  expected: string;
  actual: string;
  pass: boolean | null;
  notes: string;
}

const LINKS_KEY = "qualify-desk-links-v1";
const LOGS_KEY = "qualify-desk-call-logs-v1";
const SUBMIT_KEY = "qualify-desk-submit-v1";

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
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
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
    try {
      const rawLogs = localStorage.getItem(LOGS_KEY);
      if (rawLogs) setCallLogs(JSON.parse(rawLogs) as CallLogEntry[]);
    } catch {
      /* ignore */
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
            <Tab current={view} id="logs" onSelect={setView} icon={<History className="size-4" aria-hidden="true" />} label="Call logs" />
            <Tab current={view} id="submit" onSelect={setView} icon={<ClipboardList className="size-4" aria-hidden="true" />} label="Submission" />
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
        {view === "logs" && (
          <CallLogsView
            logs={callLogs}
            setLogs={(next) => {
              setCallLogs(next);
              localStorage.setItem(LOGS_KEY, JSON.stringify(next));
            }}
          />
        )}
        {view === "submit" && (
          <SubmissionView
            profile={profile}
            links={links}
            callLogs={callLogs}
            promptText={promptText}
          />
        )}
        {view === "approach" && <ApproachView onDownload={() => downloadText("lap-approach.md", APPROACH_MD)} />}
      </main>
    </div>
  );
}
