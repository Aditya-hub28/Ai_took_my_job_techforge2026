"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string | number;
  is_anomalous: boolean;
  anomalyScore?: number;   // 0–1, higher = more fraudulent
  volume?: number;
  ringVolume?: number;
  totalIncoming?: number;
  totalOutgoing?: number;
  pagerank?: number;       // 0–1, higher = more central
  role?: "HUB" | "BRIDGE" | "MULE" | "NORMAL";
  clusterId?: number;
  clusterFraudRate?: number;
  ringIds?: number[];
  shapFactors?: { label: string; value: number }[];
  x?: number;
  y?: number;
  z?: number;
  // internal – set by force graph after simulation
  __threeObj?: THREE.Object3D;
}

interface GraphLink {
  source: string | number | GraphNode;
  target: string | number | GraphNode;
}

interface RawGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface FocusData {
  neighborSet: Set<string | number>;
}

interface TourRing {
  ringId: number;
  label: string;
  shape: "STAR" | "CHAIN" | "CYCLE" | "DENSE";
  members: (string | number)[];
  description: string;
  syndicateScore: number;
  threatLevel: "CRITICAL" | "HIGH" | "MEDIUM";
  fraudRatio: number;
  totalVolume: number;
  leadHubId: string | number;
}

interface FraudGraph3DProps {
  onNodeSelect: (node: GraphNode | null) => void;
  selectedNode: GraphNode | null;
  alertedNodeId?: string | number | null;
  // filter state passed down from page
  riskThreshold: number;
  showOnlyFraud: boolean;
  showOnlyRings: boolean;
  searchId: string;
  // lift stats up to sidebar
  onStatsUpdate?: (s: { totalNodes: number; fraudNodes: number; rings: number }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveId(ep: string | number | GraphNode): string | number {
  return typeof ep === "object" ? ep.id : ep;
}

/** Map anomalyScore or anomaly status to vibrant Green vs Red as in the reference screenshot */
function riskColor(score: number): THREE.Color {
  if (score >= 0.5) {
    return new THREE.Color("#ef4444"); // Vibrant glowing crimson red
  }
  return new THREE.Color("#22c55e"); // Crisp emerald green
}

function riskHex(score: number): string {
  return score >= 0.5 ? "#ef4444" : "#22c55e";
}

/** Scale pagerank 0–1 → sphere radius 4–18 (bold galaxy spheres like reference) */
function nodeRadius(n: GraphNode): number {
  const pr = n.pagerank ?? 0;
  return 4 + pr * 14;
}

/** Format currency cleanly into Lakhs or standard locale format */
function formatRupees(amount: number): string {
  if (!amount || isNaN(amount)) return "₹ 0";
  if (amount >= 10000000) {
    return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹ ${(amount / 100000).toFixed(2)} Lakhs`;
  }
  if (amount >= 1000) {
    return `₹ ${(amount / 1000).toFixed(1)}k`;
  }
  return `₹ ${Math.round(amount).toLocaleString("en-IN")}`;
}

// ─── Tour rings (demo data – replace with live data from /detect-rings) ───────

const DEMO_TOUR_RINGS: TourRing[] = [
  {
    ringId: 5,
    label: "Syndicate Ring #5",
    shape: "DENSE",
    members: ["11839", "13514", "3278", "9017", "9026", "9065", "9082", "9116", "9120", "9164", "9387", "9441", "9454", "9938"],
    syndicateScore: 89,
    threatLevel: "CRITICAL",
    fraudRatio: 86,
    totalVolume: 293784,
    leadHubId: "11839",
    description: "Major 14-account syndicate moving ₹2.93 Lakhs through multi-hop layered cash-out corridors.",
  },
  {
    ringId: 1,
    label: "Syndicate Ring #1",
    shape: "STAR",
    members: ["10003", "10023", "12133", "13904", "1545", "8109", "8645"],
    syndicateScore: 85,
    threatLevel: "HIGH",
    fraudRatio: 75,
    totalVolume: 165149,
    leadHubId: "10023",
    description: "Circular round-tripping — 8 accounts bouncing funds reciprocally to spoof genuine turnover.",
  },
  {
    ringId: 299,
    label: "Syndicate Ring #299",
    shape: "STAR",
    members: ["10004", "9316", "9571"],
    syndicateScore: 97,
    threatLevel: "CRITICAL",
    fraudRatio: 100,
    totalVolume: 3173599,
    leadHubId: "10004",
    description: "Super-hub #10004 laundering ₹31.7 Lakhs across primary mule bridges with high degree fan-out.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
  riskThreshold,
  showOnlyFraud,
  showOnlyRings,
  searchId,
  onStatsUpdate,
}: FraudGraph3DProps) {
  const fgRef = useRef<any>(null);
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8082";

  // ── Dynamic import of 3-D force graph (client-only) ──
  const [ForceGraph3D, setForceGraph3D] =
    useState<React.ComponentType<any> | null>(null);
  const [mounted, setMounted] = useState(false);

  // ── Data ──
  const [rawGraph, setRawGraph] = useState<RawGraph | null>(null);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [activeNodeId, setActiveNodeId] = useState<string | number | null>(
    null
  );
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"all" | "fraud" | "rings">("all");
  const [internalShowOnlyFraud, setInternalShowOnlyFraud] = useState(false);
  const [isBundled, setIsBundled] = useState(false);
  const effectiveShowOnlyFraud = showOnlyFraud || internalShowOnlyFraud || viewMode === "fraud";

  // ── Guided tour ──
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isTourPaused, setIsTourPaused] = useState(false);
  const [tourRings, setTourRings] = useState<TourRing[]>(DEMO_TOUR_RINGS);
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTourPausedRef = useRef(false);
  isTourPausedRef.current = isTourPaused;

  // ── Stats overlay ──
  const [stats, setStats] = useState({
    totalNodes: 0,
    fraudNodes: 0,
    totalEdges: 0,
    rings: 0,
  });

  const hasFitted = useRef(false);

  // ── Mount / resize ──
  useEffect(() => {
    setMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    import("react-force-graph-3d").then((mod) =>
      setForceGraph3D(() => mod.default)
    );
  }, []);

  // ── Load graph data ──
  useEffect(() => {
    if (!mounted) return;
    setLoading(true);

    async function loadGraph() {
      try {
       
        const res = await fetch(`${API_BASE}/api/graph`);
const data = await res.json();

console.log("TOTAL NODES:", data.nodes.length);
// console.log("FRAUD NODES:", data.nodes.filter(n => n.is_anomalous).length);

        // ── DEBUG: log first raw node so we can see exact field names ──
        if (data.nodes?.length > 0) {
          console.log("[MuleTrace] Raw node sample:", JSON.stringify(data.nodes[0], null, 2));
          console.log("[MuleTrace] Raw link sample:", JSON.stringify(data.links?.[0], null, 2));
          console.log("[MuleTrace] Top-level keys:", Object.keys(data));
        }

        const nodes: GraphNode[] = data.nodes.map((n: any): GraphNode => {
          // ── is_anomalous: try every known field name ──
          const isAnom = !!(
            n.isAnomalous ?? n.is_anomalous ?? n.anomalous ??
            n.isFraud ?? n.is_fraud ?? n.fraud ?? false
          );

          // ── anomalyScore: EIF returns negative path-length scores, GNN returns 0-1 ──
          // Collect every possible score field
          const candidates = [
            n.anomalyScore, n.gnnScore, n.riskScore, n.score,
            n.fraudScore, n.eifScore, n.risk,
          ].filter((v) => v != null && !isNaN(v));

          let rawScore = candidates.length > 0 ? candidates[0] : 0;

          // EIF scores are typically negative (more negative = more anomalous)
          // Normalise to 0-1 if negative
          if (rawScore < 0) {
            rawScore = Math.min(1, Math.abs(rawScore));
          }

          // If flagged anomalous but score is still near 0, set a visible floor
          const score = isAnom && rawScore < 0.5 ? Math.max(rawScore, 0.82) : rawScore;

          // ── ringIds: only assign real ring memberships from dataset ──
          let ringIds: number[] = [];
          if (Array.isArray(n.ringIds)) ringIds = n.ringIds.map(Number).filter((r: number) => r > 0);
          else if (Array.isArray(n.ring_ids)) ringIds = n.ring_ids.map(Number).filter((r: number) => r > 0);
          else if (n.ringId != null && Number(n.ringId) > 0) ringIds = [Number(n.ringId)];
          else if (n.ring_id != null && Number(n.ring_id) > 0) ringIds = [Number(n.ring_id)];
          else if (n.ring_membership != null && Number(n.ring_membership) > 0) ringIds = [Number(n.ring_membership)];

          // ── role ──
          const role: GraphNode["role"] =
            n.role ?? n.nodeRole ?? n.node_role ??
            (isAnom && (n.pagerank ?? n.pageRank ?? 0) > 0.5 ? "HUB" :
             isAnom && ringIds.length > 0 ? "BRIDGE" :
             isAnom ? "MULE" : "NORMAL");

          return {
            id: n.nodeId ?? n.node_id ?? n.id,
            is_anomalous: isAnom,
            anomalyScore: Math.min(1, Math.max(0, score)),
            volume: n.volume ?? n.txCount ?? n.tx_count ?? n.transactionCount ?? 0,
            ringVolume: Number(n.ringVolume ?? n.ring_volume ?? 0),
            totalIncoming: Number(n.totalIncoming ?? n.total_incoming ?? 0),
            totalOutgoing: Number(n.totalOutgoing ?? n.total_outgoing ?? 0),
            pagerank: n.pagerank ?? n.pageRank ?? n.page_rank ?? 0,
            role,
            clusterId: n.clusterId ?? n.cluster_id ?? n.community,
            clusterFraudRate: n.clusterFraudRate ?? n.cluster_fraud_rate,
            ringIds,
            shapFactors: n.shapFactors ?? n.shap_factors ?? [],
          };
        });

        const links: GraphLink[] = (data.links ?? data.edges ?? [])
          .filter((l: any) => (l.source ?? l.from) && (l.target ?? l.to))
          .map((l: any) => ({
            source: String(l.source ?? l.from ?? l.sourceId),
            target: String(l.target ?? l.to ?? l.targetId),
          }));

        console.log(`[MuleTrace] Mapped: ${nodes.length} nodes, ${nodes.filter(n=>n.is_anomalous).length} fraud, ${links.length} links`);

        setRawGraph({ nodes, links });
        const fraudCount = nodes.filter((n) => n.is_anomalous).length;
        const distinctRings = new Set<number>();
        nodes.forEach(n => (n.ringIds ?? []).forEach(r => distinctRings.add(r)));
        const ringCount = distinctRings.size;
        const newStats = {
          totalNodes: nodes.length,
          fraudNodes: fraudCount,
          totalEdges: links.length,
          rings: ringCount,
        };
        setStats(newStats);
        onStatsUpdate?.({ totalNodes: nodes.length, fraudNodes: fraudCount, rings: ringCount });

        // ── Populate Detective Tour with authentic syndicates from dataset ──
        const ringMap = new Map<number, GraphNode[]>();
        for (const n of nodes) {
          for (const r of n.ringIds ?? []) {
            if (r <= 0) continue;
            if (!ringMap.has(r)) ringMap.set(r, []);
            ringMap.get(r)!.push(n);
          }
        }

        if (ringMap.size > 0) {
          // Dataset ground-truth syndicate laundering volumes
          const KNOWN_SYNDICATE_VOLS: Record<number, number> = {
            299: 3173599.73,
            16: 1128950.83,
            10: 718917.04,
            6: 466139.56,
            5: 293784.60,
            11: 270974.67,
            1: 165149.90,
            8: 138251.90,
            19: 112978.01,
            13: 105530.33,
            4: 26820.51,
            3: 16083.62,
            2: 4623.25,
          };

          // Sort syndicates by member count descending
          const sortedRings = Array.from(ringMap.entries()).sort(
            (a, b) => b[1].length - a[1].length
          );

          const liveRings: TourRing[] = sortedRings.slice(0, 8).map(([rId, mNodes]) => {
            const sortedByPr = [...mNodes].sort((a, b) => (b.pagerank ?? 0) - (a.pagerank ?? 0));
            const leadHub = sortedByPr[0] || mNodes[0];
            const members = Array.from(new Set(mNodes.map((m) => String(m.id))));

            // Determine true circulating volume in Rupees
            const memberRingVols = mNodes.map((m) => Number(m.ringVolume ?? 0)).filter((v) => v > 0);
            const memberInVols = mNodes.map((m) => Number(m.totalIncoming ?? 0)).filter((v) => v > 0);
            let totalVol = memberRingVols.length > 0 ? Math.max(...memberRingVols) : 0;
            const sumIn = memberInVols.reduce((a, b) => a + b, 0);
            if (sumIn > totalVol) totalVol = sumIn;
            if (totalVol <= 0 && KNOWN_SYNDICATE_VOLS[rId]) {
              totalVol = KNOWN_SYNDICATE_VOLS[rId];
            }

            // Compute Syndicate Threat Score:
            const scores = mNodes.map((m) => m.anomalyScore ?? 0);
            const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
            const maxScore = Math.max(...scores, 0);
            const fraudCount = mNodes.filter((m) => m.is_anomalous).length;
            const fraudRatio = Math.round((fraudCount / (mNodes.length || 1)) * 100);

            // Composite syndicate score (weighted: 45% max hub risk, 30% avg member score, 25% fraud proportion)
            const rawSyndicateScore = (maxScore * 0.45 + avgScore * 0.30 + (fraudRatio / 100) * 0.25);
            const syndicateScore = Math.min(99, Math.round(Math.max(0.68, rawSyndicateScore) * 100));

            const threatLevel: TourRing["threatLevel"] =
              syndicateScore >= 85 ? "CRITICAL" : syndicateScore >= 70 ? "HIGH" : "MEDIUM";

            const shape =
              members.length >= 8
                ? "DENSE"
                : members.length >= 5
                ? "STAR"
                : members.length >= 3
                ? "CYCLE"
                : "CHAIN";

            return {
              ringId: rId,
              label: `Syndicate Ring #${rId}`,
              shape: shape as any,
              members,
              syndicateScore,
              threatLevel,
              fraudRatio,
              totalVolume: totalVol,
              leadHubId: leadHub.id,
              description: `Organised ring of ${members.length} accounts circulating ${formatRupees(totalVol)} across layered transactions. Lead Hub: #${leadHub.id}.`,
            };
          });

          console.log(`[MuleTrace] Loaded ${liveRings.length} authentic syndicates with threat scores:`, liveRings.map(r => `${r.label}: ${r.syndicateScore}% (${formatRupees(r.totalVolume)})`));
          setTourRings(liveRings);
        } else {
          // Fallback to /detect-rings if no node ringIds found
          try {
            const mlUrl = process.env.NEXT_PUBLIC_ML_URL ?? "http://localhost:8001";
            let ringRes: Response | null = await fetch(`${mlUrl}/detect-rings`).catch(() => null);
            if (!ringRes || !ringRes.ok) {
              ringRes = await fetch(`${API_BASE}/detect-rings`).catch(() => null);
            }
            if (ringRes && ringRes.ok) {
              const ringData = await ringRes.json();
              const rawRings: any[] = ringData?.rings ?? [];
              if (rawRings.length > 0) {
                const liveTop: TourRing[] = rawRings.slice(0, 5).map((r: any, i: number) => {
                  const rawNodes = r.nodes ?? r.members ?? [];
                  const members = rawNodes.map((m: any) => String(m).split("_")[0]);
                  const shape = members.length >= 6 ? "STAR" : (members.length >= 4 ? "CYCLE" : "CHAIN");
                  const sScore = Math.min(99, Math.round(Number(r.risk ?? 0.85) * 100));
                  return {
                    ringId: i + 1,
                    label: `${shape} Ring #${i + 1}`,
                    shape: shape as any,
                    members,
                    syndicateScore: sScore,
                    threatLevel: sScore >= 85 ? "CRITICAL" : "HIGH",
                    fraudRatio: 100,
                    totalVolume: Math.round(r.volume || 0),
                    leadHubId: members[0] || "",
                    description: `Syndicate of ${members.length} accounts circulating ₹${Math.round(r.volume || 0).toLocaleString()} across mule hops.`,
                  };
                });
                setTourRings(liveTop);
              }
            }
          } catch (e) {
            console.warn("[MuleTrace] Tour rings fallback active", e);
          }
        }
      } catch (err) {
        console.error("Graph load failed", err);
        generateDemoGraph();
      } finally {
        setLoading(false);
      }
    }

    loadGraph();
  }, [mounted, API_BASE, onStatsUpdate]);

  // ── Synthetic demo data (fallback when API is unreachable) ──
  function generateDemoGraph() {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    for (let c = 0; c < 8; c++) {
      const isFraudCluster = c < 3;
      const clusterSize = 15 + Math.floor(Math.random() * 20);

      for (let i = 0; i < clusterSize; i++) {
        const id = `${c}_${i}`;
        const score = isFraudCluster
          ? 0.65 + Math.random() * 0.35   // always clearly red
          : Math.random() * 0.35;          // always clearly green
        const isAnom = score > 0.6;

        const role: GraphNode["role"] =
          i === 0 && isFraudCluster ? "HUB" :
          i < 3 && isFraudCluster ? "BRIDGE" :
          isAnom ? "MULE" : "NORMAL";

        nodes.push({
          id,
          is_anomalous: isAnom,
          anomalyScore: score,
          pagerank: i === 0 ? 0.85 : Math.random() * 0.3,
          role,
          clusterId: c,
          clusterFraudRate: isFraudCluster ? 0.7 : 0.05,
          volume: Math.floor(Math.random() * 200) + 10,
          ringIds: isFraudCluster ? [c + 1] : [],
        });

        if (i > 0) links.push({ source: `${c}_0`, target: id });
      }
      if (isFraudCluster && c > 0) links.push({ source: `${c}_0`, target: `0_0` });
    }

    setRawGraph({ nodes, links });
    const fraudCount = nodes.filter(n => n.is_anomalous).length;
    const newStats = { totalNodes: nodes.length, fraudNodes: fraudCount, totalEdges: links.length, rings: 5 };
    setStats(newStats);
    onStatsUpdate?.({ totalNodes: nodes.length, fraudNodes: fraudCount, rings: 5 });
  }

  // ── Apply filters ──
  const visibleGraph = useMemo<RawGraph | null>(() => {
    if (!rawGraph) return null;

    let nodes = rawGraph.nodes;

    // 1. Risk threshold — only apply to anomalous nodes (don't hide clean nodes by threshold)
    if (riskThreshold > 0) {
      nodes = nodes.filter(
        (n) => !n.is_anomalous || (n.anomalyScore ?? 0) >= riskThreshold
      );
    }

    // 2. Show only fraud
    if (effectiveShowOnlyFraud) {
      const fraudNodes = nodes.filter((n) => n.is_anomalous || (n.anomalyScore ?? 0) >= 0.5);
      const fIds = new Set(fraudNodes.map((n) => n.id));
      const fLinks = rawGraph.links.filter(
        (l) => fIds.has(resolveId(l.source)) && fIds.has(resolveId(l.target))
      );
      return { nodes: fraudNodes, links: fLinks };
    }

    // 3. Show only ring members — fallback to anomalous nodes if no ringIds populated
    if (showOnlyRings || viewMode === "rings") {
      const ringNodes = nodes.filter((n) => (n.ringIds?.length ?? 0) > 0 || n.is_anomalous);
      const rIds = new Set(ringNodes.map((n) => n.id));
      const rLinks = rawGraph.links.filter(
        (l) => rIds.has(resolveId(l.source)) && rIds.has(resolveId(l.target))
      );
      return { nodes: ringNodes, links: rLinks };
    }

    // 4. Default: Dense 3D Connected Constellation of green normal accounts + glowing red fraud hubs
    const fraudNodes = nodes.filter((n) => n.is_anomalous || (n.anomalyScore ?? 0) >= 0.5);
    const normalNodes = nodes.filter((n) => !n.is_anomalous && (n.anomalyScore ?? 0) < 0.5);

    // Keep top fraud nodes (hubs, bridges, mules)
    const topFraud = fraudNodes.slice(0, 220);
    const topFraudIds = new Set(topFraud.map((n) => String(n.id)));

    // 1. Gather all links directly connecting fraud nodes to each other
    const fraudLinks = rawGraph.links.filter((l) => {
      const s = String(resolveId(l.source));
      const t = String(resolveId(l.target));
      return topFraudIds.has(s) && topFraudIds.has(t);
    });

    // 2. Gather links connecting fraud nodes to normal retail/victim accounts (Mule <-> Safe User)
    const fraudNormalLinks: GraphLink[] = [];
    const connectedNormalIds = new Set<string>();

    for (const l of rawGraph.links) {
      const s = String(resolveId(l.source));
      const t = String(resolveId(l.target));
      const sIsFraud = topFraudIds.has(s);
      const tIsFraud = topFraudIds.has(t);

      if ((sIsFraud && !tIsFraud) || (!sIsFraud && tIsFraud)) {
        fraudNormalLinks.push(l);
        connectedNormalIds.add(sIsFraud ? t : s);
        if (connectedNormalIds.size >= 450) break;
      }
    }

    // 3. Gather links connecting normal users to OTHER normal users (showing where safe users send/receive money!)
    const normalNormalLinks: GraphLink[] = [];
    const secondHopNormalIds = new Set<string>();

    for (const l of rawGraph.links) {
      const s = String(resolveId(l.source));
      const t = String(resolveId(l.target));
      if (!topFraudIds.has(s) && !topFraudIds.has(t)) {
        if (connectedNormalIds.has(s) || connectedNormalIds.has(t)) {
          normalNormalLinks.push(l);
          secondHopNormalIds.add(s);
          secondHopNormalIds.add(t);
          if (normalNormalLinks.length >= 900) break;
        }
      }
    }

    // 4. Combine all selected connected links
    const combinedSelectedLinks = [...fraudLinks, ...fraudNormalLinks, ...normalNormalLinks];

    // 5. Gather all nodes that participate in these active transaction links
    const allIncludedIds = new Set<string>();
    combinedSelectedLinks.forEach((l) => {
      allIncludedIds.add(String(resolveId(l.source)));
      allIncludedIds.add(String(resolveId(l.target)));
    });
    topFraudIds.forEach((id) => allIncludedIds.add(id));

    // Ensure syndicate tour members are included
    if (tourActive && tourRings[tourStep]) {
      tourRings[tourStep].members.forEach((m) => allIncludedIds.add(String(m)));
    }

    // Ensure active or searched node is included
    if (activeNodeId) {
      allIncludedIds.add(String(activeNodeId));
    }

    // Map to node objects
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((n) => nodeMap.set(String(n.id), n));

    const capped: GraphNode[] = [];
    allIncludedIds.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) capped.push(n);
    });

    // If still below 750 nodes, populate additional high-volume normal nodes and their counterparties
    if (capped.length < 600) {
      for (const n of normalNodes) {
        if (!allIncludedIds.has(String(n.id))) {
          capped.push(n);
          allIncludedIds.add(String(n.id));
          if (capped.length >= 750) break;
        }
      }
    }

    const cappedIds = new Set(capped.map((n) => String(n.id)));
    const cappedLinks = rawGraph.links.filter(
      (l) =>
        cappedIds.has(String(resolveId(l.source))) && cappedIds.has(String(resolveId(l.target)))
    );

    return { nodes: capped, links: cappedLinks };
  }, [rawGraph, riskThreshold, effectiveShowOnlyFraud, showOnlyRings, viewMode, activeNodeId, tourActive, tourStep, tourRings]);

  // ── Focus / neighbour set ──
  const focusData = useMemo<FocusData>(() => {
    if (!activeNodeId || !visibleGraph)
      return { neighborSet: new Set() };

    const neighborSet = new Set<string | number>([activeNodeId]);
    visibleGraph.links.forEach((link) => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);
      if (s === activeNodeId) neighborSet.add(t);
      if (t === activeNodeId) neighborSet.add(s);
    });

    return { neighborSet };
  }, [activeNodeId, visibleGraph]);

  // ── Camera helpers ──
  const focusCameraOnNode = useCallback((node: GraphNode) => {
    if (!fgRef.current) return;

    // Look for live simulated coordinates in force-graph instance
    const graphData = fgRef.current.graphData?.();
    const liveNodes: any[] = graphData?.nodes ?? visibleGraph?.nodes ?? [];
    const target = liveNodes.find((n: any) => String(n.id) === String(node.id)) ?? node;

    if (target.x === undefined || target.y === undefined || target.z === undefined) {
      setTimeout(() => focusCameraOnNode(node), 250);
      return;
    }

    const distance = 90;
    fgRef.current.cameraPosition(
      {
        x: target.x,
        y: target.y + 15,
        z: target.z + distance,
      },
      { x: target.x, y: target.y, z: target.z },
      1000
    );
  }, [visibleGraph]);

  const focusCameraOnRing = useCallback((memberIds: (string | number)[]) => {
    if (!fgRef.current) return;
    const graphData = fgRef.current.graphData?.();
    const liveNodes: any[] = graphData?.nodes ?? [];
    const idSet = new Set(memberIds.map(String));
    const ringNodes = liveNodes.filter((n: any) => idSet.has(String(n.id)));

    if (ringNodes.length === 0) return;

    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;
    for (const n of ringNodes) {
      if (n.x !== undefined && n.y !== undefined && n.z !== undefined) {
        sumX += n.x;
        sumY += n.y;
        sumZ += n.z;
        count++;
      }
    }

    if (count === 0) {
      setTimeout(() => focusCameraOnRing(memberIds), 250);
      return;
    }

    const cx = sumX / count;
    const cy = sumY / count;
    const cz = sumZ / count;

    let maxDist = 25;
    for (const n of ringNodes) {
      const d = Math.hypot(n.x - cx, n.y - cy, n.z - cz);
      if (d > maxDist) maxDist = d;
    }

    const camDistance = Math.max(140, maxDist * 2.8 + 60);

    fgRef.current.cameraPosition(
      {
        x: cx + camDistance * 0.45,
        y: cy + camDistance * 0.4,
        z: cz + camDistance * 0.75,
      },
      { x: cx, y: cy, z: cz },
      1400
    );
  }, []);

  // ── Search effect ──
  useEffect(() => {
    if (!searchId.trim() || !rawGraph) return;
    const cleanId = searchId.trim();
    const node = rawGraph.nodes.find(
      (n) => String(n.id) === cleanId
    );
    if (!node) return;
    setActiveNodeId(node.id);
    onNodeSelect(node);
    setTimeout(() => focusCameraOnNode(node), 200);
  }, [searchId, rawGraph, onNodeSelect, focusCameraOnNode]);

  // ── Guided Tour Controllers ──
  const advanceTour = useCallback(
    (step: number, pauseState = false) => {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);

      if (step >= tourRings.length || step < 0) {
        setTourActive(false);
        setTourStep(0);
        setIsTourPaused(false);
        setActiveNodeId(null);
        return;
      }

      setTourStep(step);
      const ring = tourRings[step];

      if (ring && ring.members.length > 0) {
        const leadMember = ring.members[0];
        const node = rawGraph?.nodes.find((n) => String(n.id) === String(leadMember));
        if (node) {
          setActiveNodeId(node.id);
          onNodeSelect(node);
        }
        setTimeout(() => focusCameraOnRing(ring.members), 200);
      }

      if (!pauseState && !isTourPausedRef.current) {
        tourTimerRef.current = setTimeout(() => {
          advanceTour((step + 1) % tourRings.length, false);
        }, 7000);
      }
    },
    [tourRings, rawGraph, focusCameraOnRing, onNodeSelect]
  );

  const startTour = useCallback(() => {
    setTourActive(true);
    setIsTourPaused(false);
    isTourPausedRef.current = false;
    advanceTour(0, false);
  }, [advanceTour]);

  const stopTour = useCallback(() => {
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    setTourActive(false);
    setTourStep(0);
    setIsTourPaused(false);
    isTourPausedRef.current = false;
    setActiveNodeId(null);
  }, []);

  const togglePauseTour = useCallback(() => {
    setIsTourPaused((prev) => {
      const next = !prev;
      isTourPausedRef.current = next;
      if (next) {
        if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
      } else {
        advanceTour(tourStep, false);
      }
      return next;
    });
  }, [tourStep, advanceTour]);

  const nextTourStep = useCallback(() => {
    advanceTour((tourStep + 1) % tourRings.length, isTourPaused);
  }, [tourStep, tourRings.length, isTourPaused, advanceTour]);

  const prevTourStep = useCallback(() => {
    advanceTour((tourStep - 1 + tourRings.length) % tourRings.length, isTourPaused);
  }, [tourStep, tourRings.length, isTourPaused, advanceTour]);

  useEffect(() => {
    return () => {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    };
  }, []);

  // ── Node object builder ──
  const buildNodeObject = useCallback(
    (node: GraphNode): THREE.Group => {
      const isActive = node.id === activeNodeId;
      const isNeighbor = focusData.neighborSet.has(node.id);
      const hasSearch = searchId.trim() !== "";
      const matchesSearch = String(node.id).includes(searchId.trim());

      // Tour highlight detection
      const isTourMember =
        tourActive &&
        tourRings[tourStep]?.members.some((m) => String(m) === String(node.id));

      const score = node.anomalyScore ?? 0;
      const color = isTourMember ? new THREE.Color("#facc15") : riskColor(score);
      const radius = nodeRadius(node) * (isTourMember ? 1.25 : 1);

      // Opacity logic: when tour is running, isolate the active syndicate
      let opacity = 1;
      if (tourActive) {
        opacity = isTourMember ? 1 : 0.12;
      } else if (activeNodeId) {
        opacity = isActive ? 1 : isNeighbor ? 0.85 : 0.22;
      } else if (hasSearch) {
        opacity = matchesSearch ? 1 : 0.15;
      }

      const group = new THREE.Group();

      // Core sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity,
          roughness: 0.25,
          metalness: 0.3,
          emissive: color,
          emissiveIntensity: node.is_anomalous ? 1.2 : (isTourMember ? 0.6 : 0.05),
        })
      );
      group.add(sphere);

      // Role ring — HUB gets bold outer ring, BRIDGE gets dashed (only shown when not dimmed)
      if (opacity > 0.5) {
        if (node.role === "HUB" && (isActive || !activeNodeId || isTourMember)) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 1.55, 0.35, 8, 32),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color("#ef4444"),
              transparent: true,
              opacity: opacity * 0.9,
            })
          );
          group.add(ring);
        } else if (node.role === "BRIDGE" && (isActive || !activeNodeId || isTourMember)) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 1.45, 0.2, 8, 24),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color("#f97316"),
              transparent: true,
              opacity: opacity * 0.75,
            })
          );
          group.add(ring);
        }
      }

      // Selection wireframe + locator beacon
      if (isActive && !tourActive) {
        const wire = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.6, 16, 16),
          new THREE.MeshBasicMaterial({
            color: "#60a5fa",
            wireframe: true,
            transparent: true,
            opacity: 0.9,
          })
        );
        group.add(wire);

        // Pulse ring for selected node
        const pulse = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 2.8, 0.4, 8, 32),
          new THREE.MeshBasicMaterial({
            color: "#3b82f6",
            transparent: true,
            opacity: 0.9,
          })
        );
        group.add(pulse);

        // Vertical locator beacon
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 30, 8),
          new THREE.MeshBasicMaterial({
            color: "#60a5fa",
            transparent: true,
            opacity: 0.8,
          })
        );
        beacon.position.y = 15;
        group.add(beacon);
      }

      // Tour highlight glow & beacon
      if (isTourMember) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.6, 16, 16),
          new THREE.MeshBasicMaterial({
            color: "#facc15",
            transparent: true,
            opacity: 0.45,
          })
        );
        group.add(glow);

        const tourTorus = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 2.4, 0.35, 8, 32),
          new THREE.MeshBasicMaterial({
            color: "#facc15",
            transparent: true,
            opacity: 0.95,
          })
        );
        group.add(tourTorus);

        // Glowing gold beacon for syndicate members
        const tourBeacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 24, 8),
          new THREE.MeshBasicMaterial({
            color: "#facc15",
            transparent: true,
            opacity: 0.85,
          })
        );
        tourBeacon.position.y = 12;
        group.add(tourBeacon);
      }

      return group;
    },
    [activeNodeId, focusData, searchId, tourActive, tourStep, tourRings]
  );

  // ── Link styling ──
  const getLinkColor = useCallback(
    (link: GraphLink): string => {
      const s = String(resolveId(link.source));
      const t = String(resolveId(link.target));

      // Tour active: highlight ring internal edges in gold, dim everything else
      if (tourActive && tourRings[tourStep]) {
        const mSet = new Set(tourRings[tourStep].members.map(String));
        if (mSet.has(s) && mSet.has(t)) {
          return "#facc15";
        }
        return "rgba(255,255,255,0.03)";
      }

      const sNode =
        typeof link.source === "object"
          ? (link.source as GraphNode)
          : visibleGraph?.nodes.find((n) => String(n.id) === s);
      const tNode =
        typeof link.target === "object"
          ? (link.target as GraphNode)
          : visibleGraph?.nodes.find((n) => String(n.id) === t);

      const sIsFraud = sNode?.is_anomalous || (sNode?.anomalyScore ?? 0) >= 0.5;
      const tIsFraud = tNode?.is_anomalous || (tNode?.anomalyScore ?? 0) >= 0.5;

      const isFraudLink = sIsFraud && tIsFraud;
      const isMixedLink = (sIsFraud && !tIsFraud) || (!sIsFraud && tIsFraud);

      if (!activeNodeId) {
        if (isFraudLink) return "rgba(239, 68, 68, 0.75)";     // Crimson red for fraud ring internal links
        if (isMixedLink) return "rgba(245, 158, 11, 0.65)";    // Vibrant amber for fraud <-> normal user flow
        return "rgba(34, 197, 94, 0.45)";                     // Crisp emerald green for safe normal user transactions
      }

      const connected = s === String(activeNodeId) || t === String(activeNodeId);
      if (!connected) return "rgba(255,255,255,0.05)";
      if (isFraudLink) return "#ef4444";
      if (isMixedLink) return "#f59e0b";
      return "#22c55e"; // Bright emerald green if active safe normal user link
    },
    [activeNodeId, visibleGraph, tourActive, tourStep, tourRings]
  );

  const getLinkWidth = useCallback(
    (link: GraphLink): number => {
      const s = String(resolveId(link.source));
      const t = String(resolveId(link.target));

      if (tourActive && tourRings[tourStep]) {
        const mSet = new Set(tourRings[tourStep].members.map(String));
        if (mSet.has(s) && mSet.has(t)) {
          return 2.5;
        }
      }

      const sNode =
        typeof link.source === "object"
          ? (link.source as GraphNode)
          : visibleGraph?.nodes.find((n) => String(n.id) === s);
      const tNode =
        typeof link.target === "object"
          ? (link.target as GraphNode)
          : visibleGraph?.nodes.find((n) => String(n.id) === t);

      const sIsFraud = sNode?.is_anomalous || (sNode?.anomalyScore ?? 0) >= 0.5;
      const tIsFraud = tNode?.is_anomalous || (tNode?.anomalyScore ?? 0) >= 0.5;
      const isFraudLink = sIsFraud && tIsFraud;
      const isMixedLink = (sIsFraud && !tIsFraud) || (!sIsFraud && tIsFraud);

      if (!activeNodeId) {
        if (isFraudLink) return 1.8;
        if (isMixedLink) return 1.4;
        return 1.2; // Clean visible width for normal user transactions
      }

      const connected = s === String(activeNodeId) || t === String(activeNodeId);
      return connected ? 2.8 : 0.1;
    },
    [activeNodeId, visibleGraph, tourActive, tourStep, tourRings]
  );

  // ── Node label tooltip ──
  const getNodeLabel = useCallback((node: GraphNode): string => {
    const score = node.anomalyScore ?? 0;
    const hex = riskHex(score);
    const role = node.role ?? "NORMAL";
    const roleEmoji =
      role === "HUB" ? "🔴" : role === "BRIDGE" ? "🟠" : role === "MULE" ? "⚪" : "🟢";

    return `
      <div style="
        background:rgba(8,10,18,0.97);
        padding:12px 16px;
        border-radius:10px;
        border:1px solid ${hex};
        font-size:12px;
        color:#e5e7eb;
        min-width:180px;
        box-shadow:0 0 20px ${hex}44;
      ">
        <div style="font-weight:700;font-size:13px;color:${hex};margin-bottom:6px;">
          ${roleEmoji} Account ${node.id}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div>Role: <b style="color:${hex}">${role}</b></div>
          <div>Risk Score: <b style="color:${hex}">${(score * 100).toFixed(1)}%</b></div>
          <div>PageRank: <b>${((node.pagerank ?? 0) * 100).toFixed(1)}%</b></div>
          <div>Transactions: <b>${node.volume ?? 0}</b></div>
          ${
            (node.ringIds?.length ?? 0) > 0
              ? `<div style="margin-top:4px;color:#facc15;font-size:11px;">⚠ Ring member</div>`
              : ""
          }
        </div>
      </div>
    `;
  }, []);

  // ── Handlers ──
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeSelect(node);
      setActiveNodeId(node.id);
      focusCameraOnNode(node);
    },
    [onNodeSelect, focusCameraOnNode]
  );

  const handleResetView = useCallback(() => {
    setActiveNodeId(null);
    onNodeSelect(null);
    stopTour();
    fgRef.current?.zoomToFit(800);
  }, [onNodeSelect, stopTour]);

  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) return;
    const cam = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition({ z: cam.position.z * 0.8 }, undefined, 400);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) return;
    const cam = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition({ z: cam.position.z * 1.2 }, undefined, 400);
  }, []);



  // ─────────────────────────────────────────────────────────────────────────────

  if (!mounted || !ForceGraph3D) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Initialising 3-D Engine…
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          Loading transaction graph…
        </div>
      </div>
    );
  }

  const currentTourRing = tourActive ? tourRings[tourStep] : null;

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">

      {/* ── Stats bar (top center) ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1">
        {[
          { label: "Accounts", value: stats.totalNodes.toLocaleString(), color: "#60a5fa" },
          { label: "Fraud Nodes", value: stats.fraudNodes.toLocaleString(), color: "#ef4444" },
          { label: "Edges", value: stats.totalEdges.toLocaleString(), color: "#94a3b8" },
          { label: "Mule Rings", value: stats.rings.toLocaleString(), color: "#facc15" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="px-3 py-1.5 rounded-md text-center"
            style={{
              background: "rgba(10,12,22,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="text-xs font-mono" style={{ color }}>
              {value}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── View mode tabs (top right) ── */}
      <div
        className="absolute top-4 right-4 z-20 flex gap-1 rounded-lg p-1"
        style={{
          background: "rgba(10,12,22,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {(
          [
            { id: "all", label: "All" },
            { id: "fraud", label: "Fraud Only" },
            { id: "rings", label: "Ring Members" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            className="px-3 py-1.5 text-xs rounded-md transition-all"
            style={{
              background:
                viewMode === id ? "rgba(59,130,246,0.25)" : "transparent",
              color: viewMode === id ? "#60a5fa" : "#6b7280",
              border:
                viewMode === id
                  ? "1px solid rgba(59,130,246,0.4)"
                  : "1px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Guided Tour caption overlay ── */}
      {tourActive && currentTourRing && (
        <div
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92vw] sm:w-[470px]"
          style={{
            background: "rgba(10,12,24,0.96)",
            border: "1px solid rgba(250,204,21,0.45)",
            borderRadius: "14px",
            padding: "16px 20px",
            backdropFilter: "blur(14px)",
            boxShadow: "0 0 35px rgba(250,204,21,0.2)",
          }}
        >
          {/* Progress dots & counter */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex gap-1.5 flex-1">
              {tourRings.map((_, i) => (
                <button
                  key={i}
                  onClick={() => advanceTour(i, isTourPaused)}
                  className="h-1.5 flex-1 rounded-full transition-all hover:h-2"
                  style={{
                    background:
                      i === tourStep
                        ? "#facc15"
                        : i < tourStep
                        ? "rgba(250,204,21,0.5)"
                        : "rgba(255,255,255,0.15)",
                  }}
                  title={`Jump to Syndicate ${i + 1}`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-yellow-400 font-semibold shrink-0">
              {tourStep + 1} / {tourRings.length}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="text-xs font-mono font-bold px-2 py-1 rounded flex-shrink-0"
              style={{
                background: "rgba(250,204,21,0.2)",
                color: "#facc15",
                border: "1px solid rgba(250,204,21,0.4)",
              }}
            >
              {currentTourRing.shape}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-sm font-bold text-white truncate">
                  {currentTourRing.label}
                </div>
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0"
                  style={{
                    background:
                      currentTourRing.threatLevel === "CRITICAL"
                        ? "rgba(239,68,68,0.25)"
                        : "rgba(249,115,22,0.25)",
                    border:
                      currentTourRing.threatLevel === "CRITICAL"
                        ? "1px solid rgba(239,68,68,0.5)"
                        : "1px solid rgba(249,115,22,0.5)",
                    color:
                      currentTourRing.threatLevel === "CRITICAL" ? "#ef4444" : "#f97316",
                  }}
                >
                  <span>SCORE:</span>
                  <span className="text-white text-xs font-bold">{currentTourRing.syndicateScore}%</span>
                </div>
              </div>

              {/* Threat metric bar */}
              <div className="mb-2 p-2 rounded-lg bg-white/[0.04] border border-white/5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-gray-400 font-mono">Syndicate Score</div>
                  <div className="text-xs font-mono font-bold text-red-400">
                    {currentTourRing.syndicateScore}/100
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-mono">Ring Volume</div>
                  <div className="text-xs font-mono font-bold text-yellow-400">
                    {formatRupees(currentTourRing.totalVolume)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-mono">Ring Network</div>
                  <div className="text-xs font-mono font-bold text-blue-400">
                    {currentTourRing.members.length} Accounts
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-300 leading-relaxed mb-2">
                {currentTourRing.description}
              </div>

              {/* Member pills */}
              <div className="flex flex-wrap gap-1 mb-2">
                {currentTourRing.members.slice(0, 8).map((mId) => (
                  <button
                    key={mId}
                    onClick={() => {
                      const n = rawGraph?.nodes.find((x) => String(x.id) === String(mId));
                      if (n) {
                        setActiveNodeId(n.id);
                        onNodeSelect(n);
                        focusCameraOnNode(n);
                      }
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border transition hover:bg-yellow-500/20"
                    style={{
                      background: String(activeNodeId) === String(mId) ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.06)",
                      borderColor: String(activeNodeId) === String(mId) ? "#facc15" : "rgba(255,255,255,0.12)",
                      color: String(activeNodeId) === String(mId) ? "#fde047" : "#9ca3af",
                    }}
                  >
                    #{mId}
                  </button>
                ))}
                {currentTourRing.members.length > 8 && (
                  <span className="text-[10px] text-gray-500 self-center">
                    +{currentTourRing.members.length - 8} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive tour controls */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={prevTourStep}
                className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-300 transition"
              >
                ◀ Prev
              </button>
              <button
                onClick={togglePauseTour}
                className="px-2.5 py-1 text-xs rounded transition font-medium"
                style={{
                  background: isTourPaused ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.08)",
                  color: isTourPaused ? "#facc15" : "#e5e7eb",
                }}
              >
                {isTourPaused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button
                onClick={nextTourStep}
                className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-300 transition"
              >
                Next ▶
              </button>
            </div>
            <button
              onClick={stopTour}
              className="text-xs text-gray-400 hover:text-red-400 transition"
            >
              Stop tour ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {/* Guided tour */}
        <button
          onClick={tourActive ? stopTour : startTour}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: tourActive
              ? "rgba(250,204,21,0.2)"
              : "rgba(250,204,21,0.1)",
            border: "1px solid rgba(250,204,21,0.4)",
            color: "#facc15",
          }}
        >
          {tourActive
            ? `⏹ Stop Tour (${tourStep + 1}/${tourRings.length})`
            : "▶ Detective Tour"}
        </button>

        {/* Reset */}
        <button
          onClick={handleResetView}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: "rgba(30,32,44,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#9ca3af",
          }}
        >
          ↺ Reset View
        </button>

        {/* Bundle toggle */}
        <button
          onClick={() => {
            setIsBundled((v) => !v);
            hasFitted.current = false;
          }}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: isBundled
              ? "rgba(59,130,246,0.2)"
              : "rgba(30,32,44,0.85)",
            border: isBundled
              ? "1px solid rgba(59,130,246,0.5)"
              : "1px solid rgba(255,255,255,0.1)",
            color: isBundled ? "#60a5fa" : "#9ca3af",
          }}
        >
          ⬡ {isBundled ? "Bundled" : "Bundle Layout"}
        </button>
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2">
        {[
          { label: "+", fn: handleZoomIn },
          { label: "−", fn: handleZoomOut },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="w-9 h-9 rounded-full text-sm font-bold transition-all"
            style={{
              background: "rgba(10,12,22,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9ca3af",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Title overlay (top-left of canvas) ── */}
      <div
        className="absolute top-4 left-4 z-20 pointer-events-none"
      >
        <div className="text-white font-bold text-base tracking-wide" style={{ textShadow: "0 0 12px rgba(255,255,255,0.3)" }}>
          Fraud Transaction Network (3D)
        </div>
        <div className="text-gray-400 text-[11px] mt-0.5">
          Red nodes indicate anomalous / high-risk accounts detected via EIF
        </div>
      </div>

      {/* ── Show only fraud checkbox (top-right of canvas) ── */}
      <div
        className="absolute top-4 right-4 z-20 text-xs"
        style={{
          background: "rgba(10,12,22,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "10px 14px",
        }}
      >
        <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300">
          <input
            type="checkbox"
            checked={internalShowOnlyFraud}
            onChange={(e) => setInternalShowOnlyFraud(e.target.checked)}
            className="accent-red-500 w-3.5 h-3.5"
          />
          <span>Show only fraud nodes</span>
        </label>
      </div>

      {/* ── Legend (bottom-left of canvas) ── */}
      <div
        className="absolute bottom-6 left-4 z-20 text-xs"
        style={{
          background: "rgba(10,12,22,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "12px 14px",
        }}
      >
        <div className="text-gray-500 mb-2 font-mono text-[10px] uppercase tracking-wider">
          Legend
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444", display: "inline-block", boxShadow: "0 0 6px #ef4444" }} />
            <span className="text-gray-300">Fraud / Mule Account</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
            <span className="text-gray-300">Normal / Safe User</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 22, height: 2.5, background: "#ef4444", display: "inline-block", borderRadius: 2 }} />
            <span className="text-gray-300">Mule Ring Transfer</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 22, height: 2.5, background: "#f59e0b", display: "inline-block", borderRadius: 2 }} />
            <span className="text-gray-300">Mule ↔ Safe Retail Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 22, height: 2.5, background: "#22c55e", display: "inline-block", borderRadius: 2 }} />
            <span className="text-gray-300">Safe User Transaction</span>
          </div>
        </div>
      </div>

      {/* ── 3D Force Graph ── */}
      <ForceGraph3D
        key={isBundled ? "bundled" : "free"}
        ref={fgRef}
        graphData={visibleGraph ?? { nodes: [], links: [] }}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#000000"
        enableNodeDrag={false}
        linkWidth={getLinkWidth}
        linkColor={getLinkColor}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={getLinkColor}
        linkDirectionalParticles={(link: GraphLink) => {
          const s = String(resolveId(link.source));
          const t = String(resolveId(link.target));
          if (activeNodeId && (s === String(activeNodeId) || t === String(activeNodeId))) return 3;
          return 1;
        }}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={0.005}
        nodeLabel={getNodeLabel}
        nodeThreeObject={buildNodeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          setActiveNodeId(null);
          onNodeSelect(null);
        }}
        d3AlphaDecay={isBundled ? 0.04 : 0.02}
        d3VelocityDecay={isBundled ? 0.6 : 0.28}
        onEngineStop={() => {
          if (!hasFitted.current) {
            fgRef.current?.zoomToFit(800);
            hasFitted.current = true;
          }
        }}
        d3Force={isBundled ? (forceName: string, force: any) => {
          if (forceName === "charge") force.strength(-60);
          if (forceName === "link") force.distance(30).strength(0.8);
        } : (forceName: string, force: any) => {
          if (forceName === "charge") force.strength(-120);
          if (forceName === "link") force.distance(45).strength(0.65);
        }}
      />
    </div>
  );
}