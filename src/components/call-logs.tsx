import { useState } from "react";

export interface CallLogEntry {
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

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function CallLogsView({
  logs,
  setLogs,
}: {
  logs: CallLogEntry[];
  setLogs: (next: CallLogEntry[]) => void;
}) {
  const [form, setForm] = useState({
    callId: "",
    scenario: "",
    status: "completed",
    duration: "",
    recordingUrl: "",
    transcript: "",
    expected: "",
    actual: "",
    pass: "" as "" | "pass" | "fail",
    notes: "",
  });

  function addLog() {
    if (!form.callId.trim() && !form.recordingUrl.trim()) return;
    const entry: CallLogEntry = {
      id: crypto.randomUUID(),
      callId: form.callId.trim() || "—",
      scenario: form.scenario.trim() || "Manual entry",
      timestamp: new Date().toISOString(),
      status: form.status,
      duration: form.duration.trim() || "—",
      recordingUrl: form.recordingUrl.trim(),
      transcript: form.transcript.trim(),
      expected: form.expected.trim(),
      actual: form.actual.trim(),
      pass: form.pass === "pass" ? true : form.pass === "fail" ? false : null,
      notes: form.notes.trim(),
    };
    setLogs([entry, ...logs]);
    setForm({
      callId: "",
      scenario: "",
      status: "completed",
      duration: "",
      recordingUrl: "",
      transcript: "",
      expected: "",
      actual: "",
      pass: "",
      notes: "",
    });
  }

  function removeLog(id: string) {
    setLogs(logs.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-card p-4 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">Call logs & recordings</h2>
        <p className="mt-2 text-sm text-muted">
          Paste real call IDs, timestamps, and public recording links returned by Retell, Bolna, or your voice platform.
          Simulated practice on the Call floor is never shown as a graded recording here.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Call ID</span>
            <input
              value={form.callId}
              onChange={(e) => setForm((f) => ({ ...f, callId: e.target.value }))}
              placeholder="e.g. call_abc123"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Scenario name</span>
            <input
              value={form.scenario}
              onChange={(e) => setForm((f) => ({ ...f, scenario: e.target.value }))}
              placeholder="Clean eligible file"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            >
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="no-answer">No answer</option>
              <option value="busy">Busy</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Duration</span>
            <input
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              placeholder="2m 14s"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Public recording URL</span>
            <input
              value={form.recordingUrl}
              onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Expected outcome</span>
            <input
              value={form.expected}
              onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
              placeholder="Handoff"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Actual outcome</span>
            <input
              value={form.actual}
              onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))}
              placeholder="Handoff"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Pass / Fail</span>
            <select
              value={form.pass}
              onChange={(e) => setForm((f) => ({ ...f, pass: e.target.value as "" | "pass" | "fail" }))}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            >
              <option value="">Not marked</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Transcript excerpt / notes</span>
            <textarea
              value={form.transcript}
              onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={addLog}
          className="mt-4 min-h-11 rounded-lg bg-teal px-5 text-sm font-semibold text-card"
        >
          Add call log
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-card p-6 text-sm text-muted">
          No real call logs yet. After you run test calls on Retell or Bolna, add the Call ID and public recording link here.
        </p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{log.scenario}</p>
                  <p className="text-xs text-muted">
                    {log.callId} · {new Date(log.timestamp).toLocaleString("en-IN")} · {log.status} · {log.duration}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {log.pass === true && (
                    <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-semibold text-good">Pass</span>
                  )}
                  {log.pass === false && (
                    <span className="rounded-full bg-rose-soft px-2 py-0.5 text-xs font-semibold text-rose">Fail</span>
                  )}
                  <button type="button" onClick={() => removeLog(log.id)} className="text-xs text-muted underline">
                    Remove
                  </button>
                </div>
              </div>
              {(log.expected || log.actual) && (
                <p className="mt-2 text-sm">
                  Expected: <span className="font-medium">{log.expected || "—"}</span>
                  {" · "}
                  Actual: <span className="font-medium">{log.actual || "—"}</span>
                </p>
              )}
              {log.recordingUrl && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <a href={log.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-teal underline">
                    Open recording
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(log.recordingUrl)}
                    className="text-muted underline"
                  >
                    Copy link
                  </button>
                </div>
              )}
              {log.transcript && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{log.transcript}</p>}
              {log.notes && <p className="mt-1 text-xs text-muted">{log.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
