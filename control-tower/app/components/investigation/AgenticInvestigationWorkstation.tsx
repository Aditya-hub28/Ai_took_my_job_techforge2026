"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert, Bot, CheckCircle2, AlertTriangle, ArrowRight,
  Search, CornerDownLeft, Sparkles, Network, Clock, ShieldCheck,
  FileText, ExternalLink, RefreshCw, Layers, Fingerprint, Cpu,
  Database, UserCheck, AlertOctagon, Share2
} from "lucide-react";

interface StepTrace {
  tool: string;
  status: string; // COMPLETED, UNAVAILABLE, FAILED, RUNNING
  durationMs: number;
  recordCount: number;
  error?: string;
}

interface EvidenceItem {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  accountId: string;
  amount?: number;
  sourceTool: string;
  timestamp: string;
}

interface InvestigationSummary {
  verdict: string;
  confidence: number;
  keyFindings: string[];
  traceableAmount: number;
  potentiallyProtectedAmount: number;
  freezeFrontierCandidateCount: number;
  suggestedNextSteps: string[];
  fullNarrative: string;
}

interface AuditAction {
  action: string;
  timestamp: string;
  actor: string;
  note: string;
}

interface InvestigationRecord {
  id: string;
  targetAccount: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  maxHops: number;
  targetAmount: number;
  steps: StepTrace[];
  evidence: EvidenceItem[];
  auditTrail: AuditAction[];
  summary?: InvestigationSummary;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  riskScore: number;
  hop: number;
  status: string;
  fraud: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  timestamp: string;
  type: string;
}

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  description: string;
  amount: number;
  severity: string;
  sourceAccount: string;
  targetAccount: string;
  transactionId?: string;
}

const PRESETS = [
  { id: "10004", label: "Mule #10004", role: "High-Velocity Pass-Through", amt: 50000 },
  { id: "1030",  label: "Origin #1030", role: "Fan-Out Dispersal", amt: 75000 },
  { id: "10023", label: "Hop-1 #10023", role: "Layering Bridge Node", amt: 25000 },
  { id: "11839", label: "Frontier #11839", role: "High-Retention Frontier", amt: 60000 },
];

const QUICK_QUERIES = [
  "Why is this account suspicious?",
  "How much suspicious money is still traceable?",
  "Which accounts are on the freeze frontier?",
  "Show devices shared with suspicious accounts",
  "Does this account belong to a mule ring?",
  "Show transactions responsible for velocity"
];

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8082";

export default function AgenticInvestigationWorkstation({ initialAccount = "10004" }: { initialAccount?: string }) {
  const [targetAccount, setTargetAccount] = useState(initialAccount);
  const [customAmount, setCustomAmount] = useState<number>(50000);
  const [maxHops, setMaxHops] = useState<number>(2);

  const [investigation, setInvestigation] = useState<InvestigationRecord | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphEdge[] } | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"findings" | "graph" | "timeline" | "audit">("findings");
  const [evidenceFilter, setEvidenceFilter] = useState<string>("ALL");

  // Natural Language Copilot State
  const [queryInput, setQueryInput] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState<any | null>(null);

  // Human in the Loop Decision Modal / State
  const [decisionNotes, setDecisionNotes] = useState("");
  const [officerName, setOfficerName] = useState("Lead Officer");
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load or run investigation
  const runInvestigation = async (accId?: string, amt?: number) => {
    const acc = accId || targetAccount;
    const amount = amt || customAmount;
    setLoading(true);
    setQueryResponse(null);
    setActionSuccessMessage(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/investigation/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAccount: acc, customAmount: amount, maxHops }),
      });

      if (res.ok) {
        const data: InvestigationRecord = await res.json();
        setInvestigation(data);

        // Fetch graph and timeline
        fetchGraph(acc);
        fetchTimeline(acc);
      } else {
        setError(`Investigation server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.error("Failed to run investigation:", err);
      setError("Unable to connect to investigation engine at " + API_BASE);
    } finally {
      setLoading(false);
    }
  };

  const fetchGraph = async (accId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/investigation/${accId}/graph`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    }
  };

  const fetchTimeline = async (accId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/investigation/${accId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimelineEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
    }
  };

  const handleAskQuery = async (questionText?: string) => {
    const q = questionText || queryInput;
    if (!q.trim()) return;

    setQueryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/investigation/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investigationId: investigation?.id,
          targetAccount: targetAccount,
          query: q,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQueryResponse(data);
      }
    } catch (err) {
      console.error("Query failed:", err);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleRecordDecision = async (decision: "CONFIRMED" | "CLEARED" | "ESCALATED") => {
    if (!investigation) return;
    try {
      const res = await fetch(`${API_BASE}/api/investigation/${investigation.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          investigatorName: officerName,
          note: decisionNotes || `Status updated to ${decision} by ${officerName}`,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setInvestigation(updated);
        setActionSuccessMessage(`Case ${updated.id} successfully updated to status: ${decision}`);
        setTimeout(() => setActionSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error("Failed to submit decision:", err);
    }
  };

  useEffect(() => {
    runInvestigation(initialAccount);
  }, [initialAccount]);

  const filteredEvidence = investigation?.evidence.filter((item) => {
    if (evidenceFilter === "ALL") return true;
    if (evidenceFilter === "CRITICAL_HIGH") return item.severity === "CRITICAL" || item.severity === "HIGH";
    if (evidenceFilter === "MONEY_FLOW") return item.type === "MONEY_FLOW" || item.type === "FREEZE_FRONTIER";
    if (evidenceFilter === "IDENTITY") return item.type === "SHARED_DEVICE" || item.type === "SHARED_IP";
    return true;
  }) || [];

  return (
    <div className="w-full space-y-6 font-sans text-white">

      {/* ── TOP HEADER & CASE BANNER ── */}
      <div className="bg-[#0b0b0b] border border-white/[0.08] rounded-2xl p-5 sm:p-7 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#CAFF33]/[0.02] blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/30 uppercase font-mono">
                <Bot className="w-3.5 h-3.5" />
                AI Investigation Agent
              </span>
              {investigation && (
                <span className="text-[11px] font-mono text-white/50 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.07]">
                  Case: <strong className="text-white font-bold">{investigation.id}</strong>
                </span>
              )}
              {investigation && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  investigation.status === "CONFIRMED" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  investigation.status === "CLEARED" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                  investigation.status === "ESCALATED" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                  "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                }`}>
                  ● {investigation.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              Autonomous Financial Crime <span className="text-[#CAFF33]">Investigator</span>
            </h1>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl mt-1">
              Deterministic 11-tool forensic pipeline executing graph, temporal, behavioral, and money-flow analysis. Grounded evidence without hallucinations.
            </p>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => runInvestigation()}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#CAFF33] text-black font-black text-xs uppercase tracking-wider hover:bg-[#CAFF33]/90 transition-all shadow-[0_0_25px_rgba(202,255,51,0.25)] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Investigating..." : "Rerun Investigation"}
            </button>
          </div>
        </div>

        {/* Input Parameters & Presets */}
        <div className="pt-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2">
              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Target:</span>
              <input
                type="text"
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                placeholder="Account ID (e.g. 10004)"
                className="bg-transparent text-sm font-mono font-bold text-white focus:outline-none w-28"
              />
            </div>

            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2">
              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Amount:</span>
              <span className="text-xs text-white/40">₹</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                className="bg-transparent text-sm font-mono font-bold text-white focus:outline-none w-24"
              />
            </div>

            <button
              onClick={() => runInvestigation(targetAccount, customAmount)}
              className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] rounded-xl text-xs font-bold text-white transition-colors"
            >
              Inspect
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider mr-1">Presets:</span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setTargetAccount(p.id);
                  setCustomAmount(p.amt);
                  runInvestigation(p.id, p.amt);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                  targetAccount === p.id
                    ? "bg-[#CAFF33]/15 text-[#CAFF33] border-[#CAFF33]/30"
                    : "bg-white/[0.03] text-white/70 border-white/[0.08] hover:border-white/20"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => runInvestigation()}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-white font-mono text-[10px] uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 7-STAGE FINANCIAL CRIME WORKFLOW RIBBON ── */}
      <div className="bg-[#080808] border border-white/[0.07] rounded-xl p-3.5 overflow-x-auto shadow-inner">
        <div className="flex items-center gap-2 min-w-[780px] text-[10px] font-mono uppercase tracking-wider">
          <span className="text-white/40 font-bold shrink-0">Pipeline:</span>
          {[
            { n: "1", label: "Detection Alert", active: true },
            { n: "2", label: "11-Tool Agent", active: true },
            { n: "3", label: "Evidence Dossier", active: (investigation?.evidence?.length ?? 0) > 0 },
            { n: "4", label: "Money Flow DAG", active: (investigation?.summary?.traceableAmount ?? 0) > 0 },
            { n: "5", label: "Freeze Frontier", active: (investigation?.summary?.potentiallyProtectedAmount ?? 0) > 0 },
            { n: "6", label: "Human Verdict", active: investigation?.status === "CONFIRMED" || investigation?.status === "CLEARED" || investigation?.status === "ESCALATED" },
            { n: "7", label: "Audit Trail", active: (investigation?.auditTrail?.length ?? 0) > 0 },
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                s.active
                  ? "bg-[#CAFF33]/10 border-[#CAFF33]/30 text-[#CAFF33] font-bold shadow-[0_0_10px_rgba(202,255,51,0.1)]"
                  : "bg-white/[0.02] border-white/[0.05] text-white/40"
              }`}>
                <span className="opacity-60">{s.n}.</span>
                <span>{s.label}</span>
              </div>
              {idx < 6 && <span className="text-white/20">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── AGENT EXECUTION TRACE (TRANSPARENT 11-TOOL STEPPER) ── */}
      <div className="bg-[#0a0a0a] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#CAFF33]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Agent Execution Trace ({investigation?.steps?.length || 0}/11 Tools)
            </h3>
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            {investigation?.completedAt ? "Execution Completed" : "Deterministic Run"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {investigation?.steps.map((st, idx) => {
            const isCompleted = st.status === "COMPLETED";
            const isUnavailable = st.status === "UNAVAILABLE";
            const isFailed = st.status === "FAILED";

            return (
              <div
                key={st.tool + idx}
                className={`p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]"
                    : isUnavailable
                    ? "bg-amber-500/[0.04] border-amber-500/20 text-amber-200"
                    : "bg-red-500/[0.04] border-red-500/20 text-red-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-white/40">#{idx + 1}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-[#CAFF33]" />}
                  {isUnavailable && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {isFailed && <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                </div>
                <p className="text-[11px] font-mono font-bold truncate text-white" title={st.tool}>
                  {st.tool.replace(/_/g, " ")}
                </p>
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.04] text-[9px] font-mono text-white/50">
                  <span>{st.durationMs}ms</span>
                  <span>{isUnavailable ? "N/A" : `${st.recordCount} recs`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NATURAL LANGUAGE QUERY CONSOLE (INVESTIGATOR COPILOT) ── */}
      <div className="bg-[#0d0d0d] border border-[#CAFF33]/20 rounded-2xl p-5 sm:p-6 shadow-[0_0_40px_rgba(202,255,51,0.03)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#CAFF33]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#CAFF33]">
            Natural Language Investigation Copilot
          </h3>
          <span className="text-[10px] text-white/40 font-mono ml-auto">Grounded Backend Retrieval</span>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 bg-[#050505] border border-white/[0.12] rounded-xl p-2 focus-within:border-[#CAFF33]/50 transition-colors">
          <Search className="w-4 h-4 text-white/40 ml-2 shrink-0" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskQuery()}
            placeholder="Ask anything: 'Why is this account suspicious?', 'Which accounts to freeze?', 'Show devices'..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-white/35 focus:outline-none font-mono"
          />
          <button
            onClick={() => handleAskQuery()}
            disabled={queryLoading || !queryInput.trim()}
            className="px-4 py-2 rounded-lg bg-[#CAFF33] text-black font-bold text-xs uppercase tracking-wider hover:bg-[#CAFF33]/90 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {queryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CornerDownLeft className="w-3.5 h-3.5" />}
            Ask Agent
          </button>
        </div>

        {/* Quick Suggested Queries */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-3 pb-1">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider shrink-0">Quick Queries:</span>
          {QUICK_QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setQueryInput(q);
                handleAskQuery(q);
              }}
              className="text-[11px] font-mono text-white/70 hover:text-[#CAFF33] bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1 rounded-lg border border-white/[0.06] shrink-0 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Query Result Box */}
        {queryResponse && (
          <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.1] space-y-3 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-[#CAFF33]/20 text-[#CAFF33] px-2 py-0.5 rounded font-bold">
                  Intent: {queryResponse.matchedIntent}
                </span>
                <span className="text-[10px] text-white/40 font-mono">
                  Executed Tools: {queryResponse.executedTools?.join(", ")}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-sans font-medium">
              {queryResponse.answer}
            </p>

            {queryResponse.suggestedNextSteps?.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04]">
                <p className="text-[10px] uppercase font-bold text-white/40 mb-1.5">Suggested Next Steps:</p>
                <div className="flex flex-wrap gap-2">
                  {queryResponse.suggestedNextSteps.map((st: string, idx: number) => (
                    <span key={idx} className="text-[10px] text-white/70 bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.06]">
                      → {st}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TOP KPI SUMMARY SCORECARDS ── */}
      {investigation?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.07] relative overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">AI Verdict</p>
            <p className="text-xl font-black text-white font-mono uppercase">
              {investigation.summary.verdict.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono">
              Confidence: <span className="text-[#CAFF33] font-bold">{(investigation.summary.confidence * 100).toFixed(1)}%</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.07]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Traceable Fraud Money</p>
            <p className="text-2xl font-black text-white font-mono">
              ₹{investigation.summary.traceableAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono">Downstream Dispersal</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-[#CAFF33]/30 bg-[#CAFF33]/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#CAFF33] mb-1">Potentially Protected</p>
            <p className="text-2xl font-black text-[#CAFF33] font-mono">
              ₹{investigation.summary.potentiallyProtectedAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono">
              Via <span className="text-white font-bold">{investigation.summary.freezeFrontierCandidateCount}</span> Frontier Nodes
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.07]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Compiled Evidence</p>
            <p className="text-2xl font-black text-white font-mono">
              {investigation.evidence.length} Items
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono">Factual & Audit-Logged</p>
          </div>
        </div>
      )}

      {/* ── WORKSTATION TAB NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          onClick={() => setActiveTab("findings")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "findings"
              ? "bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          Forensic Evidence & Summary ({investigation?.evidence.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("graph")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "graph"
              ? "bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Network className="w-4 h-4" />
          Investigation Graph ({graphData?.nodes?.length || 0} Nodes)
        </button>

        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "timeline"
              ? "bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Clock className="w-4 h-4" />
          Chronological Timeline ({timelineEvents.length})
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "audit"
              ? "bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Trail & Decisions ({investigation?.auditTrail?.length || 0})
        </button>
      </div>

      {/* ── TAB 1: EVIDENCE & FORMAL SUMMARY ── */}
      {activeTab === "findings" && (
        <div className="space-y-6">

          {/* AI Narrative Card */}
          {investigation?.summary && (
            <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#CAFF33] font-mono flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  Official Investigation Narrative
                </span>
                <span className="text-[10px] text-white/40 font-mono">
                  Grounded on {investigation.evidence.length} Evidence Records
                </span>
              </div>
              <p className="text-sm text-white/90 leading-relaxed font-sans">
                {investigation.summary.fullNarrative}
              </p>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] uppercase font-bold text-white/40 mr-1">Filter:</span>
              {[
                { id: "ALL", label: "All Evidence" },
                { id: "CRITICAL_HIGH", label: "Critical & High" },
                { id: "MONEY_FLOW", label: "Money Flow & Freeze Frontier" },
                { id: "IDENTITY", label: "Devices & IPs" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEvidenceFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                    evidenceFilter === f.id
                      ? "bg-white/[0.1] text-white border-white/20"
                      : "bg-white/[0.02] text-white/50 border-white/[0.06] hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Evidence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvidence.map((ev) => {
              const isCrit = ev.severity === "CRITICAL";
              const isHigh = ev.severity === "HIGH";

              return (
                <div
                  key={ev.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isCrit
                      ? "bg-red-500/[0.03] border-red-500/30 hover:border-red-500/50"
                      : isHigh
                      ? "bg-amber-500/[0.03] border-amber-500/30 hover:border-amber-500/50"
                      : "bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono tracking-wider ${
                        isCrit ? "bg-red-500/20 text-red-400" :
                        isHigh ? "bg-amber-500/20 text-amber-300" :
                        "bg-white/[0.06] text-white/70"
                      }`}
                    >
                      {ev.severity}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      Tool: {ev.sourceTool}
                    </span>
                  </div>

                  <p className="text-xs font-mono font-bold text-white/50 mb-1">
                    TYPE: <span className="text-white">{ev.type}</span>
                  </p>

                  <p className="text-sm font-medium text-white/90 leading-snug mb-3">
                    {ev.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] text-[10px] font-mono text-white/50">
                    <span>Account: #{ev.accountId}</span>
                    {ev.amount && ev.amount > 0 && (
                      <span className="text-[#CAFF33] font-bold">
                        ₹{ev.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: INVESTIGATION NETWORK GRAPH ── */}
      {activeTab === "graph" && (
        <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Discovered Forensics Topology (Bounded 2 Hops)
              </h3>
              <p className="text-xs text-white/50">
                Visualizing target account #{investigation?.targetAccount}, direct counterparties, and Freeze Frontier intercept nodes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Origin Mule
              </span>
              <span className="flex items-center gap-1.5 text-[#CAFF33]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#CAFF33]" /> Freeze Frontier
              </span>
              <span className="flex items-center gap-1.5 text-white/50">
                <span className="w-2.5 h-2.5 rounded-full bg-white/40" /> Counterparty
              </span>
            </div>
          </div>

          {/* SVG Graph Visualization */}
          <div className="w-full h-96 bg-[#050505] rounded-xl border border-white/[0.06] relative overflow-hidden flex items-center justify-center">
            {graphData && graphData.nodes.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 800 400">
                {/* Render Links */}
                {graphData.links.map((l, i) => {
                  const nodeCount = graphData.nodes.length;
                  const idx = i % Math.max(1, nodeCount - 1);
                  const angle = (idx / Math.max(1, nodeCount - 1)) * 2 * Math.PI;
                  const targetX = 400 + Math.cos(angle) * 160;
                  const targetY = 200 + Math.sin(angle) * 120;

                  return (
                    <g key={i}>
                      <line
                        x1={400}
                        y1={200}
                        x2={targetX}
                        y2={targetY}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={1.5}
                        strokeDasharray={l.amount > 10000 ? "4 4" : "none"}
                      />
                    </g>
                  );
                })}

                {/* Render Counterparty Nodes */}
                {graphData.nodes.map((n, i) => {
                  const isCentral = n.status === "ORIGIN";
                  const isFrontier = n.status === "FRONTIER";

                  let x = 400;
                  let y = 200;

                  if (!isCentral) {
                    const angle = ((i - 1) / Math.max(1, graphData.nodes.length - 1)) * 2 * Math.PI;
                    x = 400 + Math.cos(angle) * 160;
                    y = 200 + Math.sin(angle) * 120;
                  }

                  const fillColor = isCentral ? "#ef4444" : isFrontier ? "#CAFF33" : "#3b82f6";

                  return (
                    <g key={n.id} className="cursor-pointer group">
                      <circle
                        cx={x}
                        cy={y}
                        r={isCentral ? 20 : 13}
                        fill={fillColor}
                        fillOpacity={0.2}
                        stroke={fillColor}
                        strokeWidth={2}
                      />
                      <circle cx={x} cy={y} r={isCentral ? 9 : 5} fill={fillColor} />
                      <text
                        x={x}
                        y={y + (isCentral ? 32 : 24)}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={10}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        #{n.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <p className="text-xs text-white/40 font-mono">No graph relationships found for this entity.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: CHRONOLOGICAL TIMELINE ── */}
      {activeTab === "timeline" && (
        <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Chronological Movement & Risk Velocity
            </h3>
            <span className="text-[10px] text-white/40 font-mono">Audit Sequence</span>
          </div>

          <div className="space-y-3 relative pl-6 border-l border-white/[0.1] ml-2">
            {timelineEvents.map((evt, idx) => (
              <div key={idx} className="relative group">
                <span className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 ${
                  evt.severity === "CRITICAL" ? "bg-red-500 border-black" :
                  evt.severity === "HIGH" ? "bg-amber-400 border-black" :
                  "bg-[#CAFF33] border-black"
                }`} />

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-white/40">{evt.timestamp}</span>
                      <span className="text-[9px] font-mono uppercase bg-white/[0.06] px-1.5 py-0.5 rounded text-white/70">
                        {evt.eventType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-white">{evt.description}</p>
                  </div>

                  {evt.amount > 0 && (
                    <span className="text-sm font-mono font-bold text-[#CAFF33] shrink-0">
                      ₹{evt.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: AUDIT TRAIL & DECISION RECORD ── */}
      {activeTab === "audit" && (
        <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Chain-of-Custody Audit Trail
            </h3>
            <span className="text-[10px] text-white/40 font-mono">Immutable Compliance Log</span>
          </div>

          <div className="space-y-2.5">
            {investigation?.auditTrail.map((act, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-[#CAFF33]">{act.action}</span>
                    <span className="text-white/40 font-mono text-[10px]">• Actor: {act.actor}</span>
                  </div>
                  <p className="text-white/80">{act.note}</p>
                </div>
                <span className="text-[10px] font-mono text-white/40 shrink-0">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HUMAN-IN-THE-LOOP ACTION & DECISION BAR ── */}
      <div className="bg-[#0b0b0b] border border-white/[0.1] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#CAFF33]" />
              Human Investigator Final Authority
            </h3>
            <p className="text-xs text-white/50">
              The AI Agent assists and synthesizes evidence. Only authorized compliance officers execute binding enforcement actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="Officer Name"
              className="bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs font-mono text-white"
            />
          </div>
        </div>

        <input
          type="text"
          value={decisionNotes}
          onChange={(e) => setDecisionNotes(e.target.value)}
          placeholder="Optional investigator rationale / case notes for audit trail..."
          className="w-full bg-[#050505] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 font-mono"
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => handleRecordDecision("CONFIRMED")}
            className="px-5 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Mark Confirmed Mule
          </button>

          <button
            onClick={() => handleRecordDecision("ESCALATED")}
            className="px-5 py-2.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Escalate to FIU / Cyber Cell
          </button>

          <button
            onClick={() => handleRecordDecision("CLEARED")}
            className="px-5 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Clear Account (False Positive)
          </button>

          <a
            href={`/dashboard?tab=recovery&account=${targetAccount}`}
            className="ml-auto px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#CAFF33] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Simulate Freeze Frontier
          </a>
        </div>
      </div>

    </div>
  );
}
