"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldAlert,
  Snowflake,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Layers,
  Lock,
  Unlock,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Clock,
  ChevronRight,
  Sparkles,
  Info,
  DollarSign,
  Bot
} from "lucide-react";

interface FlowNode {
  id: string;
  label: string;
  riskScore: number;
  role: string;
  amountReceived: number;
  amountForwarded: number;
  amountRetained: number;
  hop: number;
  isOrigin: boolean;
  isFrontier: boolean;
  isTerminal: boolean;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  timestamp: string;
  hop: number;
  percentOfSource: number;
  isHighRisk: boolean;
}

interface FlowTimelineEvent {
  timestamp: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  hop: number;
  note: string;
}

interface FlowSummary {
  originAccount: string;
  originalAmount: number;
  traceableAmount: number;
  hopsExplored: number;
  totalNodesCount: number;
  frontierAccountsCount: number;
  totalRetained: number;
}

interface FreezeCandidate {
  accountId: string;
  potentialProtectedAmount: number;
  downstreamExposure: number;
  riskScore: number;
  hopDistance: number;
  connectedSuspiciousCount: number;
  recency: string;
  traceablePercentage: number;
  role: string;
  reasons: string[];
}

interface StrategyOption {
  strategyId: string;
  title: string;
  description: string;
  targetAccounts: string[];
  accountsCount: number;
  potentialProtectedAmount: number;
  estimatedRemainingExposure: number;
  protectionRate: number;
}

interface MoneyRecoverySimulationProps {
  initialAccount?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8082";

function formatINR(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return "₹0";
  return "₹" + Math.round(val).toLocaleString("en-IN");
}

export default function MoneyRecoverySimulation({ initialAccount = "10004" }: MoneyRecoverySimulationProps) {
  const [accountInput, setAccountInput] = useState(initialAccount);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core Data
  const [summary, setSummary] = useState<FlowSummary | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [timeline, setTimeline] = useState<FlowTimelineEvent[]>([]);
  const [candidates, setCandidates] = useState<FreezeCandidate[]>([]);
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);

  // Simulation Interactive State
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [activeStrategy, setActiveStrategy] = useState<string | null>("B");
  const [isSynthetic, setIsSynthetic] = useState(false);

  // Real-time calculated simulation figures
  const originalAmount = summary?.originalAmount ?? 85000;
  const traceableAmount = summary?.traceableAmount ?? originalAmount;

  // Compute live recovery based on selected freeze accounts
  const simulationMetrics = useMemo(() => {
    if (nodes.length === 0) {
      return {
        protectedAmount: 0,
        remainingExposure: originalAmount,
        protectionRate: 0,
        affectedAccounts: new Set<string>()
      };
    }

    // Build adjacency
    const adj: Record<string, string[]> = {};
    for (const e of edges) {
      if (!adj[e.source]) adj[e.source] = [];
      adj[e.source].push(e.target);
    }

    // Determine all accounts halted downstream of selected frozen nodes
    const affected = new Set<string>(selectedAccounts);
    for (const f of selectedAccounts) {
      const q = [f];
      while (q.length > 0) {
        const curr = q.shift()!;
        for (const nxt of adj[curr] ?? []) {
          if (!affected.has(nxt)) {
            affected.add(nxt);
            q.push(nxt);
          }
        }
      }
    }

    // Sum protected inflow across independent frozen nodes
    let protectedSum = 0;
    for (const accId of selectedAccounts) {
      const node = nodes.find(n => n.id === accId);
      if (node) {
        protectedSum += node.amountReceived;
      }
    }

    // Ensure ceiling and conservation
    const finalProtected = Math.min(protectedSum, traceableAmount);
    const remaining = Math.max(0, originalAmount - finalProtected);
    const rate = originalAmount > 0 ? Number(((finalProtected / originalAmount) * 100).toFixed(1)) : 0;

    return {
      protectedAmount: finalProtected,
      remainingExposure: remaining,
      protectionRate: Math.min(100, rate),
      affectedAccounts: affected
    };
  }, [selectedAccounts, nodes, edges, originalAmount, traceableAmount]);

  // Load flow and candidates from backend
  const runSimulation = useCallback(async (targetAcc: string, amt?: number) => {
    setLoading(true);
    setError(null);
    setIsSynthetic(false);

    try {
      const cleanAcc = targetAcc.trim();
      const payload: any = { originAccount: cleanAcc };
      if (amt && amt > 0) payload.customAmount = amt;

      // 1. Fetch money flow
      const flowRes = await fetch(`${API_BASE}/api/investigation/money-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!flowRes.ok) throw new Error(`Flow API returned HTTP ${flowRes.status}`);
      const flowData = await flowRes.json();

      // 2. Fetch freeze frontier
      const frontierRes = await fetch(`${API_BASE}/api/investigation/freeze-frontier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!frontierRes.ok) throw new Error(`Frontier API returned HTTP ${frontierRes.status}`);
      const frontierData = await frontierRes.json();

      setSummary(flowData.summary);
      setNodes(flowData.nodes ?? []);
      setEdges(flowData.edges ?? []);
      setTimeline(flowData.timeline ?? []);
      setCandidates(frontierData.candidates ?? []);
      setStrategies(frontierData.strategies ?? []);

      // Default apply Strategy B (top 3) if available
      const stratB = (frontierData.strategies ?? []).find((s: StrategyOption) => s.strategyId === "B");
      if (stratB && stratB.targetAccounts?.length > 0) {
        setSelectedAccounts(new Set(stratB.targetAccounts));
        setActiveStrategy("B");
      } else if (frontierData.candidates?.length > 0) {
        setSelectedAccounts(new Set([frontierData.candidates[0].accountId]));
        setActiveStrategy("A");
      } else {
        setSelectedAccounts(new Set());
        setActiveStrategy(null);
      }
    } catch (err: any) {
      console.error("[MoneyRecoverySimulation] Error:", err);
      setError(err.message || "Failed to load simulation data from backend");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Step 14 Synthetic Benchmark Test Scenario
  const loadBenchmarkTest = async () => {
    setLoading(true);
    setError(null);
    setIsSynthetic(true);

    try {
      const res = await fetch(`${API_BASE}/api/investigation/test-scenario`);
      if (!res.ok) throw new Error(`Test scenario returned HTTP ${res.status}`);
      const data = await res.json();

      setSummary(data.summary);
      setNodes(data.nodes);
      setEdges(data.edges);
      setTimeline(data.timeline);
      setAccountInput("M1");
      setCustomAmount("100000");

      // Build synthetic candidates
      const synCandidates: FreezeCandidate[] = [
        {
          accountId: "M2",
          potentialProtectedAmount: 60000,
          downstreamExposure: 50000,
          riskScore: 0.88,
          hopDistance: 2,
          connectedSuspiciousCount: 1,
          recency: "2 mins ago",
          traceablePercentage: 60.0,
          role: "BRIDGE",
          reasons: [
            "Received ₹60,000 from Primary Mule M1",
            "Forwarded ₹50,000 to POS terminal M4",
            "Retains ₹10,000 un-forwarded balance",
            "High GNN anomaly risk score (88%)"
          ]
        },
        {
          accountId: "M3",
          potentialProtectedAmount: 30000,
          downstreamExposure: 0,
          riskScore: 0.82,
          hopDistance: 2,
          connectedSuspiciousCount: 0,
          recency: "3 mins ago",
          traceablePercentage: 30.0,
          role: "FRONTIER",
          reasons: [
            "Received ₹30,000 from Primary Mule M1",
            "Full ₹30,000 retained with zero onward flow",
            "Identified as stagnant Freeze Frontier holding account"
          ]
        },
        {
          accountId: "M4",
          potentialProtectedAmount: 50000,
          downstreamExposure: 0,
          riskScore: 0.91,
          hopDistance: 3,
          connectedSuspiciousCount: 0,
          recency: "6 mins ago",
          traceablePercentage: 50.0,
          role: "FRONTIER",
          reasons: [
            "Terminal cash-out account receiving ₹50,000 from M2",
            "Final exit point of the suspicious chain"
          ]
        }
      ];
      setCandidates(synCandidates);

      const synStrategies: StrategyOption[] = [
        {
          strategyId: "A",
          title: "Strategy A: Target Lead Bridge (M2)",
          description: "Freeze M2 to prevent ₹60,000 from dispersing into downstream POS terminal M4.",
          targetAccounts: ["M2"],
          accountsCount: 1,
          potentialProtectedAmount: 60000,
          estimatedRemainingExposure: 40000,
          protectionRate: 60.0
        },
        {
          strategyId: "B",
          title: "Strategy B: Dual Frontier Freeze (M2 + M3)",
          description: "Freeze both outbound branches M2 and M3 to protect ₹90,000 (90% of original stolen volume).",
          targetAccounts: ["M2", "M3"],
          accountsCount: 2,
          potentialProtectedAmount: 90000,
          estimatedRemainingExposure: 10000,
          protectionRate: 90.0
        },
        {
          strategyId: "C",
          title: "Strategy C: Full Frontier Perimeter (M2, M3, M4)",
          description: "Freeze all reachable holding and terminal accounts across all hops.",
          targetAccounts: ["M2", "M3", "M4"],
          accountsCount: 3,
          potentialProtectedAmount: 100000,
          estimatedRemainingExposure: 0,
          protectionRate: 100.0
        }
      ];
      setStrategies(synStrategies);
      setSelectedAccounts(new Set(["M2", "M3"]));
      setActiveStrategy("B");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation(initialAccount);
  }, [initialAccount, runSimulation]);

  // Toggle freeze checkbox
  const toggleAccount = (accId: string) => {
    setActiveStrategy(null);
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accId)) next.delete(accId);
      else next.add(accId);
      return next;
    });
  };

  // Apply Strategy Preset
  const handleApplyStrategy = (strat: StrategyOption) => {
    setActiveStrategy(strat.strategyId);
    setSelectedAccounts(new Set(strat.targetAccounts));
  };

  // Group nodes by hop for visual DAG rendering
  const nodesByHop = useMemo(() => {
    const map: Record<number, FlowNode[]> = {};
    for (const n of nodes) {
      const h = n.hop;
      if (!map[h]) map[h] = [];
      map[h].push(n);
    }
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b));
  }, [nodes]);

  return (
    <div className="w-full space-y-6 text-white">
      {/* ─── Header & Search Controls ─── */}
      <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#CAFF33]/15 text-[#CAFF33] border border-[#CAFF33]/25">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#CAFF33] font-bold">
                Intervention & Recovery Engine
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Simulation Only
              </span>
              {isSynthetic && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Step 14 Benchmark Scenario
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Money Recovery & Freeze Frontier Simulation
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Trace chronological propagation of suspicious funds across the transaction graph, locate active holding frontiers, and simulate potential asset protection rates before executing financial freezes.
            </p>
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Presets:</span>
            <button
              onClick={() => { setAccountInput("10004"); setCustomAmount("85000"); runSimulation("10004", 85000); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#161922] hover:bg-[#1e2330] border border-red-500/30 text-red-400 transition cursor-pointer"
            >
              🔴 Super-Hub #10004
            </button>
            <button
              onClick={() => { setAccountInput("10023"); setCustomAmount("50000"); runSimulation("10023", 50000); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#161922] hover:bg-[#1e2330] border border-amber-500/30 text-amber-400 transition cursor-pointer"
            >
              🟠 Bridge #10023
            </button>
            <button
              onClick={() => { setAccountInput("1553"); setCustomAmount("125000"); runSimulation("1553", 125000); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#161922] hover:bg-[#1e2330] border border-blue-500/30 text-blue-400 transition cursor-pointer"
            >
              🔵 Ring Member #1553
            </button>
            <button
              onClick={loadBenchmarkTest}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#CAFF33]/10 hover:bg-[#CAFF33]/20 border border-[#CAFF33]/40 text-[#CAFF33] transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              ⚡ Benchmark Test (V1→M1→M4)
            </button>
            <a
              href={`/dashboard?tab=investigation&account=${accountInput}`}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 transition cursor-pointer flex items-center gap-1.5"
            >
              <Bot className="w-3 h-3" />
              🤖 AI Agent Dossier
            </a>
          </div>
        </div>

        {/* Input Bar */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={accountInput}
              onChange={e => setAccountInput(e.target.value)}
              placeholder="Enter Origin Account ID (e.g. 10004)"
              className="w-full bg-[#141720] border border-white/[0.1] rounded-xl pl-10 pr-4 py-2 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#CAFF33]/60 transition"
            />
          </div>

          <div className="w-48 relative">
            <span className="text-gray-500 text-xs font-mono absolute left-3.5 top-1/2 -translate-y-1/2">₹</span>
            <input
              type="number"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder="Override Amount"
              className="w-full bg-[#141720] border border-white/[0.1] rounded-xl pl-7 pr-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#CAFF33]/60 transition"
            />
          </div>

          <button
            onClick={() => runSimulation(accountInput, customAmount ? parseFloat(customAmount) : undefined)}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-[#CAFF33] hover:bg-[#b8e62e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
            Simulate Flow
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ─── KPI Overview Cards (Step 6 & 10) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-[#0e1017] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
            Original Suspicious
          </p>
          <p className="text-lg md:text-xl font-bold font-mono text-white">
            {formatINR(originalAmount)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Origin injection / outbound</p>
        </div>

        <div className="bg-[#0e1017] border border-white/[0.08] rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-1">
            Traceable Amount
          </p>
          <p className="text-lg md:text-xl font-bold font-mono text-blue-300">
            {formatINR(traceableAmount)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Reachable in graph path</p>
        </div>

        <div className="bg-[#0e1017] border border-[#CAFF33]/30 bg-gradient-to-b from-[#CAFF33]/[0.06] to-transparent rounded-xl p-4 shadow-[0_0_20px_rgba(202,255,51,0.06)]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#CAFF33] font-bold">
              Potentially Protected
            </p>
            <Snowflake className="w-3.5 h-3.5 text-[#CAFF33]" />
          </div>
          <p className="text-lg md:text-xl font-bold font-mono text-[#CAFF33]">
            {formatINR(simulationMetrics.protectedAmount)}
          </p>
          <p className="text-[10px] text-[#CAFF33]/70 mt-1">
            {selectedAccounts.size} account{selectedAccounts.size === 1 ? "" : "s"} selected
          </p>
        </div>

        <div className="bg-[#0e1017] border border-amber-500/20 rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1">
            Remaining Exposure
          </p>
          <p className="text-lg md:text-xl font-bold font-mono text-amber-300">
            {formatINR(simulationMetrics.remainingExposure)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Untracked or escaped flow</p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#0e1017] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
              Protection Rate
            </p>
            <p className="text-xl md:text-2xl font-bold font-mono text-white">
              {simulationMetrics.protectionRate}%
            </p>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="bg-gradient-to-r from-[#CAFF33] to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${simulationMetrics.protectionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── Legal Disclaimer Alert ─── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-blue-300/80 text-[11px] font-mono">
        <Info className="w-4 h-4 shrink-0 text-blue-400" />
        <span>
          <strong className="text-blue-300 font-bold uppercase">Simulation Guardrail:</strong> Calculations indicate &quot;Potentially Protected&quot; capital based on available ledger topology. Actual asset recovery requires court orders, nodal bank verification, and freezing warrants.
        </span>
      </div>

      {/* ─── Interactive Money Flow Graph (Step 3 & 10) ─── */}
      <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#CAFF33]" />
              Downstream Money Flow & Propagation Graph
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Tracks value split, retentions, and onward transmission across each hop. Blue highlight indicates accounts frozen in simulation.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/20 border border-blue-500" />
              Frozen Candidate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500" />
              Active Mule / Frontier
            </span>
          </div>
        </div>

        {/* DAG Flow Visualization */}
        <div className="overflow-x-auto pb-4 pt-2">
          <div className="min-w-[800px] flex items-start justify-between gap-8 relative px-4">
            {nodesByHop.map(([hopStr, hopNodes]) => {
              const hopNum = parseInt(hopStr);
              return (
                <div key={hopStr} className="flex-1 flex flex-col items-center gap-4">
                  {/* Hop Column Header */}
                  <div className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-white/[0.04] border border-white/[0.08] text-gray-400">
                    {hopNum === 0 ? "Origin Injection" : `Hop ${hopNum}`}
                  </div>

                  {/* Nodes in this hop */}
                  <div className="w-full space-y-3.5">
                    {hopNodes.slice(0, 6).map(node => {
                      const isFrozen = selectedAccounts.has(node.id);
                      const isAffected = simulationMetrics.affectedAccounts.has(node.id);

                      return (
                        <div
                          key={node.id}
                          onClick={() => !node.isOrigin && toggleAccount(node.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isFrozen
                              ? "bg-blue-950/40 border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.25)]"
                              : isAffected
                              ? "bg-purple-950/20 border-purple-500/40 opacity-75"
                              : node.isOrigin
                              ? "bg-[#141822] border-amber-500/40 cursor-default"
                              : node.isFrontier
                              ? "bg-red-950/20 border-red-500/40 hover:border-red-500/70"
                              : "bg-[#12151e] border-white/[0.08] hover:border-white/[0.2]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                              {isFrozen ? (
                                <Snowflake className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                              ) : (
                                <span className={`w-2 h-2 rounded-full ${node.isOrigin ? "bg-amber-400" : node.isFrontier ? "bg-red-400" : "bg-green-400"}`} />
                              )}
                              Acc #{node.id}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              node.riskScore >= 0.8 ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              Risk {(node.riskScore * 100).toFixed(0)}%
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] font-mono">
                            <div className="flex justify-between text-gray-400">
                              <span>Received:</span>
                              <span className="text-white font-semibold">{formatINR(node.amountReceived)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                              <span>Forwarded:</span>
                              <span className="text-gray-300">{formatINR(node.amountForwarded)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-white/[0.06] text-gray-300">
                              <span className="text-[10px] text-gray-500">Retained:</span>
                              <span className={`font-bold ${node.amountRetained > 0 ? "text-[#CAFF33]" : "text-gray-500"}`}>
                                {formatINR(node.amountRetained)}
                              </span>
                            </div>
                          </div>

                          {/* Role tag */}
                          <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                              {node.role}
                            </span>
                            {!node.isOrigin && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                isFrozen ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.06] text-gray-400"
                              }`}>
                                {isFrozen ? "FROZEN" : "CLICK TO FREEZE"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {hopNodes.length > 6 && (
                      <div className="p-2 text-center text-[10px] font-mono text-gray-500 bg-white/[0.02] rounded-lg">
                        + {hopNodes.length - 6} more accounts in hop
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Freeze Strategies Comparison (Step 8) ─── */}
      <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-5 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#CAFF33]" />
            Intervention Strategy Comparison
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            MuleTrace analyzes topological trade-offs across targeted, balanced, and full perimeter freezing strategies. Select any strategy to pre-populate candidates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {strategies.map(s => {
            const isActive = activeStrategy === s.strategyId;
            return (
              <div
                key={s.strategyId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isActive
                    ? "bg-[#141a24] border-[#CAFF33]/60 shadow-[0_0_15px_rgba(202,255,51,0.12)]"
                    : "bg-[#11141d] border-white/[0.08] hover:border-white/[0.18]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#CAFF33]">
                      {s.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-300">
                      {s.accountsCount} Acc{s.accountsCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    {s.description}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">Potential Protected:</span>
                    <span className="text-[#CAFF33] font-bold">{formatINR(s.potentialProtectedAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">Remaining Exposure:</span>
                    <span className="text-amber-400 font-semibold">{formatINR(s.estimatedRemainingExposure)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">Protection Rate:</span>
                    <span className="text-white font-bold">{s.protectionRate}%</span>
                  </div>

                  <button
                    onClick={() => handleApplyStrategy(s)}
                    className={`w-full mt-3 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? "bg-[#CAFF33] text-black"
                        : "bg-white/[0.06] hover:bg-white/[0.12] text-white"
                    }`}
                  >
                    {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    {isActive ? "Active Strategy" : "Apply Strategy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Freeze Frontier Candidate Table (Step 4, 5, 7, 10) ─── */}
      <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              Freeze Frontier Candidates & Interactive What-If Simulation
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Ranked candidates holding or routing suspicious funds. Toggle checkboxes to dynamically simulate recovery impact.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedAccounts(new Set(candidates.map(c => c.accountId)))}
              className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 transition"
            >
              Select All
            </button>
            <button
              onClick={() => { setSelectedAccounts(new Set()); setActiveStrategy(null); }}
              className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-gray-400 text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Freeze</th>
                <th className="py-2.5 px-3">Account ID</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Risk Score</th>
                <th className="py-2.5 px-3">Potentially Protected</th>
                <th className="py-2.5 px-3">Hop</th>
                <th className="py-2.5 px-3">Traceable %</th>
                <th className="py-2.5 px-3">Recommendation Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {candidates.slice(0, 15).map(c => {
                const isSelected = selectedAccounts.has(c.accountId);
                return (
                  <tr
                    key={c.accountId}
                    onClick={() => toggleAccount(c.accountId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-500/[0.08]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by row click
                        className="rounded border-gray-700 text-[#CAFF33] focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                      {isSelected ? <Snowflake className="w-3.5 h-3.5 text-blue-400" /> : null}
                      #{c.accountId}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-gray-300">
                        {c.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.riskScore >= 0.8 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {(c.riskScore * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#CAFF33]">
                      {formatINR(c.potentialProtectedAmount)}
                    </td>
                    <td className="py-3 px-3 text-gray-300">{c.hopDistance}</td>
                    <td className="py-3 px-3 text-gray-300">{c.traceablePercentage}%</td>
                    <td className="py-3 px-3 max-w-md">
                      <div className="space-y-1">
                        {c.reasons.map((r, i) => (
                          <div key={i} className="text-[11px] text-gray-300 leading-snug flex items-center gap-1.5">
                            <span className="text-red-400 text-[10px]">▸</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {candidates.length > 15 && (
            <div className="p-3 text-center text-xs font-mono text-gray-500">
              Showing top 15 of {candidates.length} freeze candidates.
            </div>
          )}
        </div>
      </div>

      {/* ─── Chronological Money Movement Timeline (Step 9 & 10) ─── */}
      <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-5 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#CAFF33]" />
            Money Movement Velocity & Chronological Timeline
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Step-by-step propagation timeline documenting velocity of fraudulent dispersal across the network.
          </p>
        </div>

        <div className="space-y-3">
          {timeline.slice(0, 10).map((evt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-[#12141c] border border-white/[0.06] text-xs font-mono"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded bg-white/[0.06] text-gray-400 text-[10px]">
                  {evt.timestamp}
                </span>
                <span className="text-white font-bold">
                  Acc #{evt.fromAccount}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#CAFF33]" />
                <span className="text-white font-bold">
                  Acc #{evt.toAccount}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[#CAFF33] font-bold text-sm">
                  {formatINR(evt.amount)}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] text-gray-400">
                  Hop {evt.hop}
                </span>
              </div>
            </div>
          ))}

          {timeline.length === 0 && (
            <div className="p-6 text-center text-xs font-mono text-gray-500">
              No chronological transfer events recorded for this selection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
