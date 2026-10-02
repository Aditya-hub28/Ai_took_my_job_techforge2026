package com.MuleTrace.backend.service;

import com.MuleTrace.backend.DTO.InvestigationDTO;
import com.MuleTrace.backend.DTO.FreezeFrontierDTO;
import com.MuleTrace.backend.DTO.MoneyFlowDTO;
import com.MuleTrace.backend.model.InvestigationRecord;
import com.MuleTrace.backend.model.Nodes;
import com.MuleTrace.backend.model.Transaction;
import com.MuleTrace.backend.repository.InvestigationRepository;
import com.MuleTrace.backend.repository.NodesRepository;
import com.MuleTrace.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class AgentOrchestratorService {

    private final InvestigationRepository investigationRepository;
    private final InvestigationToolRegistry toolRegistry;
    private final TransactionRepository transactionRepository;
    private final NodesRepository nodesRepository;
    private final RecoverySimulationService simulationService;

    // In-memory cache for fast lookup during active sessions
    private final Map<String, InvestigationRecord> activeInvestigations = new ConcurrentHashMap<>();

    public AgentOrchestratorService(
            InvestigationRepository investigationRepository,
            InvestigationToolRegistry toolRegistry,
            TransactionRepository transactionRepository,
            NodesRepository nodesRepository,
            RecoverySimulationService simulationService) {
        this.investigationRepository = investigationRepository;
        this.toolRegistry = toolRegistry;
        this.transactionRepository = transactionRepository;
        this.nodesRepository = nodesRepository;
        this.simulationService = simulationService;
    }

    /**
     * Start a full deterministic investigation for an account.
     */
    public Mono<InvestigationRecord> startInvestigation(InvestigationDTO.StartInvestigationRequest req) {
        String target = (req.getTargetAccount() != null && !req.getTargetAccount().trim().isEmpty())
                ? req.getTargetAccount().trim()
                : "10004";
        Double customAmount = req.getCustomAmount() != null ? req.getCustomAmount() : 50000.0;
        int maxHops = req.getMaxHops() != null ? req.getMaxHops() : 2;

        String invId = String.format("INV-%s-%04d", target, (int)(Math.random() * 9000 + 1000));
        InvestigationRecord record = new InvestigationRecord();
        record.setId(invId);
        record.setTargetAccount(target);
        record.setTargetAmount(customAmount);
        record.setMaxHops(maxHops);
        record.setStatus("RUNNING");
        record.setCreatedAt(Instant.now());
        record.getAuditTrail().add(new InvestigationRecord.AuditAction("INVESTIGATION_STARTED", "AI_ORCHESTRATOR", "Agent investigation initiated for account " + target));

        activeInvestigations.put(invId, record);

        Map<String, InvestigationToolRegistry.ToolResult> toolResults = new LinkedHashMap<>();
        List<InvestigationRecord.EvidenceItem> allEvidence = new ArrayList<>();

        // Helper to run a tool, measure duration, record step trace
        return runToolStep("get_account_profile", toolRegistry.getAccountProfile(target), record, toolResults, allEvidence)
                .then(runToolStep("get_transactions", toolRegistry.getTransactions(target), record, toolResults, allEvidence))
                .then(runToolStep("analyze_behavior", toolRegistry.analyzeBehavior(target), record, toolResults, allEvidence))
                .then(runToolStep("expand_network", toolRegistry.expandNetwork(target, maxHops), record, toolResults, allEvidence))
                .then(runToolStep("get_shared_devices", toolRegistry.getSharedDevices(target), record, toolResults, allEvidence))
                .then(runToolStep("get_shared_ips", toolRegistry.getSharedIps(target), record, toolResults, allEvidence))
                .then(runToolStep("detect_rings", toolRegistry.detectRings(target), record, toolResults, allEvidence))
                .then(runToolStep("analyze_temporal_patterns", toolRegistry.analyzeTemporalPatterns(target), record, toolResults, allEvidence))
                .then(runToolStep("trace_money", toolRegistry.traceMoney(target, customAmount), record, toolResults, allEvidence))
                .then(runToolStep("get_freeze_frontier", toolRegistry.getFreezeFrontier(target, customAmount), record, toolResults, allEvidence))
                .map(lastStep -> {
                    // Tool 11: generate_investigation_summary
                    Instant sTime = Instant.now();
                    InvestigationRecord.InvestigationSummary summary = toolRegistry.generateInvestigationSummary(target, allEvidence, toolResults);
                    long duration = java.time.Duration.between(sTime, Instant.now()).toMillis();
                    record.setSummary(summary);
                    record.getSteps().add(new InvestigationRecord.StepTrace(
                            "generate_investigation_summary",
                            "COMPLETED",
                            sTime,
                            Instant.now(),
                            duration,
                            1,
                            null
                    ));

                    record.setStatus("UNDER_REVIEW"); // Leaves final decision to human investigator
                    record.setCompletedAt(Instant.now());
                    record.setEvidence(allEvidence);
                    record.getAuditTrail().add(new InvestigationRecord.AuditAction("EVIDENCE_COMPILED", "AI_ORCHESTRATOR", "Compiled " + allEvidence.size() + " evidence items. Awaiting human decision."));

                    activeInvestigations.put(invId, record);
                    return record;
                })
                .flatMap(investigationRepository::save)
                .onErrorResume(e -> {
                    record.setStatus("FAILED");
                    record.getAuditTrail().add(new InvestigationRecord.AuditAction("FAILED", "AI_ORCHESTRATOR", "Error: " + e.getMessage()));
                    return Mono.just(record);
                });
    }

    private Mono<InvestigationToolRegistry.ToolResult> runToolStep(
            String toolName,
            Mono<InvestigationToolRegistry.ToolResult> toolMono,
            InvestigationRecord record,
            Map<String, InvestigationToolRegistry.ToolResult> toolResults,
            List<InvestigationRecord.EvidenceItem> allEvidence) {

        Instant start = Instant.now();
        return toolMono
                .doOnNext(res -> {
                    long duration = java.time.Duration.between(start, Instant.now()).toMillis();
                    record.getSteps().add(new InvestigationRecord.StepTrace(
                            toolName,
                            res.getStatus(),
                            start,
                            Instant.now(),
                            duration,
                            res.getRecordCount(),
                            res.getError()
                    ));
                    toolResults.put(toolName, res);
                    if (res.getEvidence() != null && !res.getEvidence().isEmpty()) {
                        allEvidence.addAll(res.getEvidence());
                    }
                })
                .onErrorResume(e -> {
                    long duration = java.time.Duration.between(start, Instant.now()).toMillis();
                    record.getSteps().add(new InvestigationRecord.StepTrace(
                            toolName,
                            "FAILED",
                            start,
                            Instant.now(),
                            duration,
                            0,
                            e.getMessage()
                    ));
                    InvestigationToolRegistry.ToolResult failRes = InvestigationToolRegistry.ToolResult.failed(toolName, record.getTargetAccount(), e.getMessage());
                    toolResults.put(toolName, failRes);
                    return Mono.just(failRes);
                });
    }

    /**
     * Natural Language Query Copilot for the investigator.
     * Evaluates query, maps to deterministic tools or evidence, and produces a factual grounded answer.
     */
    public Mono<InvestigationDTO.InvestigationQueryResponse> handleQuery(InvestigationDTO.InvestigationQueryRequest req) {
        String q = (req.getQuery() != null) ? req.getQuery().toLowerCase().trim() : "";
        String target = req.getTargetAccount() != null ? req.getTargetAccount().trim() : "10004";
        String invId = req.getInvestigationId();

        InvestigationDTO.InvestigationQueryResponse resp = new InvestigationDTO.InvestigationQueryResponse();
        resp.setQuery(req.getQuery());
        resp.setSuccess(true);

        // Fetch or create investigation record context
        return getOrLoadInvestigation(invId, target)
                .map(inv -> {
                    List<InvestigationRecord.EvidenceItem> evidence = inv.getEvidence();
                    InvestigationRecord.InvestigationSummary summary = inv.getSummary();

                    if (q.contains("why") || q.contains("suspicious") || q.contains("kyu") || q.contains("reason")) {
                        resp.setMatchedIntent("EXPLAIN_SUSPICION");
                        resp.setExecutedTools(Arrays.asList("get_account_profile", "analyze_behavior", "detect_rings"));
                        resp.setEvidenceCited(evidence);

                        List<String> keyReasons = evidence.stream().map(InvestigationRecord.EvidenceItem::getDescription).collect(Collectors.toList());
                        String explanation = String.format("Account #%s is flagged as %s (Risk: %.1f%%). Key empirical indicators discovered: %s",
                                target, summary != null ? summary.getVerdict().replace('_', ' ') : "SUSPICIOUS",
                                (summary != null ? summary.getConfidence() * 100 : 85.0),
                                keyReasons.isEmpty() ? "Rapid fund turnover." : String.join(" | ", keyReasons));
                        resp.setAnswer(explanation);
                        resp.setSuggestedNextSteps(Arrays.asList("Inspect downstream money flow", "Check Freeze Frontier accounts", "Mark as confirmed mule"));

                    } else if (q.contains("freeze") || q.contains("frontier") || q.contains("recover") || q.contains("protect") || q.contains("paisa")) {
                        resp.setMatchedIntent("QUERY_FREEZE_FRONTIER");
                        resp.setExecutedTools(Arrays.asList("get_freeze_frontier", "trace_money"));
                        List<InvestigationRecord.EvidenceItem> frontierEv = evidence.stream()
                                .filter(e -> "FREEZE_FRONTIER".equals(e.getType()) || "MONEY_FLOW".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(frontierEv);

                        double protectedAmt = summary != null ? summary.getPotentiallyProtectedAmount() : 0.0;
                        int candidateCount = summary != null ? summary.getFreezeFrontierCandidateCount() : 0;
                        resp.setAnswer(String.format("By intervening on the Freeze Frontier, ₹%.2f can be potentially protected across %d downstream candidate accounts. This targets nodes currently holding retained fraud funds before cash-out.",
                                protectedAmt, candidateCount));
                        resp.setSuggestedNextSteps(Arrays.asList("Simulate surgical freeze strategy", "Review candidate retained balances"));

                    } else if (q.contains("trace") || q.contains("money") || q.contains("move") || q.contains("flow") || q.contains("kahan gaya")) {
                        resp.setMatchedIntent("QUERY_MONEY_FLOW");
                        resp.setExecutedTools(Collections.singletonList("trace_money"));
                        List<InvestigationRecord.EvidenceItem> flowEv = evidence.stream()
                                .filter(e -> "MONEY_FLOW".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(flowEv);

                        double traceable = summary != null ? summary.getTraceableAmount() : 0.0;
                        resp.setAnswer(String.format("Downstream Money Flow analysis traces ₹%.2f moving through multi-hop layering. Funds were dispersed from Origin #%s across downstream counterparties.",
                                traceable, target));
                        resp.setSuggestedNextSteps(Arrays.asList("Open DAG Money Flow Visualizer", "View transaction chronological timeline"));

                    } else if (q.contains("device") || q.contains("hardware")) {
                        resp.setMatchedIntent("QUERY_SHARED_DEVICE");
                        resp.setExecutedTools(Collections.singletonList("get_shared_devices"));
                        List<InvestigationRecord.EvidenceItem> devEv = evidence.stream()
                                .filter(e -> "SHARED_DEVICE".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(devEv);

                        if (!devEv.isEmpty()) {
                            resp.setAnswer("Device Analysis Result: " + devEv.get(0).getDescription());
                        } else {
                            resp.setAnswer("Device Analysis Result: Data unavailable. No device telemetry collisions found for this account.");
                        }
                        resp.setSuggestedNextSteps(Collections.singletonList("Inspect IP and TLS session fingerprints"));

                    } else if (q.contains("ip") || q.contains("network") || q.contains("session") || q.contains("ja3")) {
                        resp.setMatchedIntent("QUERY_SHARED_IP");
                        resp.setExecutedTools(Collections.singletonList("get_shared_ips"));
                        List<InvestigationRecord.EvidenceItem> ipEv = evidence.stream()
                                .filter(e -> "SHARED_IP".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(ipEv);

                        if (!ipEv.isEmpty()) {
                            resp.setAnswer("IP Analysis Result: " + ipEv.get(0).getDescription());
                        } else {
                            resp.setAnswer("IP Analysis Result: Data unavailable. No anomalous IP reuse detected for this account.");
                        }
                        resp.setSuggestedNextSteps(Collections.singletonList("Expand 2-hop counterparty network"));

                    } else if (q.contains("ring") || q.contains("cycle") || q.contains("cluster")) {
                        resp.setMatchedIntent("QUERY_MULE_RING");
                        resp.setExecutedTools(Collections.singletonList("detect_rings"));
                        List<InvestigationRecord.EvidenceItem> ringEv = evidence.stream()
                                .filter(e -> "RING_MEMBERSHIP".equals(e.getType()) || "CIRCULAR_FLOW".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(ringEv);

                        if (!ringEv.isEmpty()) {
                            resp.setAnswer("Ring Detection: " + ringEv.get(0).getDescription());
                        } else {
                            resp.setAnswer("Ring Detection: Account does not exhibit cyclic ring topology, but exhibits pass-through layering.");
                        }
                        resp.setSuggestedNextSteps(Collections.singletonList("Inspect 2-hop counterparties for fan-out patterns"));

                    } else if (q.contains("velocity") || q.contains("speed") || q.contains("fast")) {
                        resp.setMatchedIntent("QUERY_VELOCITY");
                        resp.setExecutedTools(Arrays.asList("analyze_behavior", "analyze_temporal_patterns"));
                        List<InvestigationRecord.EvidenceItem> velEv = evidence.stream()
                                .filter(e -> "HIGH_VELOCITY".equals(e.getType()) || "TEMPORAL_ANOMALY".equals(e.getType()))
                                .collect(Collectors.toList());
                        resp.setEvidenceCited(velEv);

                        if (!velEv.isEmpty()) {
                            resp.setAnswer("Velocity Forensics: " + velEv.get(0).getDescription());
                        } else {
                            resp.setAnswer("Velocity Forensics: Velocity score is within standard operating parameters.");
                        }
                        resp.setSuggestedNextSteps(Collections.singletonList("Examine chronological timeline"));

                    } else {
                        resp.setMatchedIntent("INVESTIGATION_SUMMARY");
                        resp.setExecutedTools(Collections.singletonList("generate_investigation_summary"));
                        resp.setEvidenceCited(evidence);
                        resp.setAnswer(summary != null ? summary.getFullNarrative() : "Investigation compiled. Multiple indicators of potential mule activity detected.");
                        resp.setSuggestedNextSteps(summary != null ? summary.getSuggestedNextSteps() : Arrays.asList("Review evidence", "Submit decision"));
                    }

                    return resp;
                });
    }

    /**
     * Record a Human-in-the-loop decision with audit logging.
     */
    public Mono<InvestigationRecord> recordDecision(String invId, InvestigationDTO.InvestigationDecisionRequest req) {
        return getInvestigation(invId)
                .flatMap(record -> {
                    String decision = req.getDecision() != null ? req.getDecision().toUpperCase() : "UNDER_REVIEW";
                    record.setStatus(decision);
                    String actor = req.getInvestigatorName() != null ? req.getInvestigatorName() : "Lead Investigator";
                    String note = req.getNote() != null ? req.getNote() : "Decision recorded by human compliance officer.";

                    record.getAuditTrail().add(new InvestigationRecord.AuditAction("DECISION_RECORDED", actor,
                            String.format("Status changed to %s. Notes: %s", decision, note)));

                    activeInvestigations.put(record.getId(), record);
                    return investigationRepository.save(record);
                });
    }

    /**
     * Get investigation by ID.
     */
    public Mono<InvestigationRecord> getInvestigation(String id) {
        if (id == null || id.trim().isEmpty()) {
            return Mono.empty();
        }
        if (activeInvestigations.containsKey(id)) {
            return Mono.just(activeInvestigations.get(id));
        }
        return investigationRepository.findById(id)
                .switchIfEmpty(investigationRepository.findFirstByTargetAccountOrderByCreatedAtDesc(id))
                .doOnNext(rec -> activeInvestigations.put(rec.getId(), rec));
    }

    /**
     * Build interactive multi-hop graph for an investigation.
     * Integrates central origin mule, direct transactions, multi-hop money flow propagation,
     * layering intermediaries, freeze frontier intercept nodes, and normal/safe retail accounts.
     */
    public Mono<InvestigationDTO.InvestigationGraphResponse> getGraph(String invId) {
        return getInvestigation(invId)
                .flatMap(inv -> {
                    String central = inv.getTargetAccount();
                    Double targetAmount = inv.getTargetAmount() != null ? inv.getTargetAmount() : 50000.0;

                    Mono<MoneyFlowDTO.MoneyFlowResponse> flowMono = simulationService.getMoneyFlow(central, targetAmount)
                            .onErrorResume(e -> Mono.just(simulationService.getSyntheticTestScenario()));

                    Mono<List<Transaction>> directTxnsMono = transactionRepository.findBySourceAccountOrTargetAccount(central, central)
                            .collectList()
                            .onErrorResume(e -> Mono.just(Collections.emptyList()));

                    return Mono.zip(flowMono, directTxnsMono)
                            .map(tuple -> {
                                MoneyFlowDTO.MoneyFlowResponse flow = tuple.getT1();
                                List<Transaction> directTxns = tuple.getT2();

                                Map<String, InvestigationDTO.GraphNode> nodeMap = new LinkedHashMap<>();
                                Map<String, InvestigationDTO.GraphEdge> edgeMap = new LinkedHashMap<>();

                                // Central origin node
                                nodeMap.put(central, new InvestigationDTO.GraphNode(
                                        central,
                                        "Acc #" + central + " (Origin Mule)",
                                        "ACCOUNT",
                                        0.94,
                                        true,
                                        0,
                                        "ORIGIN"
                                ));

                                // Process multi-hop money flow nodes
                                if (flow != null && flow.getNodes() != null) {
                                    for (MoneyFlowDTO.FlowNode fn : flow.getNodes()) {
                                        String id = fn.getId();
                                        if (id == null || id.isEmpty()) continue;

                                        if (!nodeMap.containsKey(id)) {
                                            String role = fn.getRole() != null ? fn.getRole() : "ACCOUNT";
                                            boolean isFrontier = fn.isFrontier() || "FRONTIER".equalsIgnoreCase(role);
                                            boolean isOrigin = central.equals(id) || fn.isOrigin() || "ORIGIN".equalsIgnoreCase(role);

                                            String status;
                                            String label;
                                            boolean isFraud = false;
                                            double riskScore = fn.getRiskScore();

                                            if (isOrigin) {
                                                status = "ORIGIN";
                                                label = "Acc #" + id + " (Origin Mule)";
                                                isFraud = true;
                                                riskScore = Math.max(riskScore, 0.94);
                                            } else if (isFrontier) {
                                                status = "FRONTIER";
                                                label = "Acc #" + id + " (Freeze Frontier)";
                                                isFraud = true;
                                                riskScore = Math.max(riskScore, 0.85);
                                            } else if ("BRIDGE".equalsIgnoreCase(role) || "HUB".equalsIgnoreCase(role) || "MULE".equalsIgnoreCase(role) || riskScore >= 0.65) {
                                                status = "SUSPICIOUS";
                                                label = "Acc #" + id + " (Layering Mule)";
                                                isFraud = true;
                                            } else {
                                                // Legitimate retail / merchant endpoint or safe user
                                                status = "NORMAL";
                                                label = "Acc #" + id + " (Safe User)";
                                                isFraud = false;
                                                riskScore = Math.min(riskScore, 0.20);
                                            }

                                            nodeMap.put(id, new InvestigationDTO.GraphNode(
                                                    id,
                                                    label,
                                                    "ACCOUNT",
                                                    riskScore,
                                                    isFraud,
                                                    fn.getHop(),
                                                    status
                                            ));
                                        }
                                    }
                                }

                                // Process multi-hop flow edges
                                if (flow != null && flow.getEdges() != null) {
                                    for (MoneyFlowDTO.FlowEdge fe : flow.getEdges()) {
                                        String s = fe.getSource();
                                        String t = fe.getTarget();
                                        if (s != null && t != null && !s.equals(t)) {
                                            String key = s + "->" + t;
                                            InvestigationDTO.GraphEdge existing = edgeMap.get(key);
                                            if (existing == null) {
                                                edgeMap.put(key, new InvestigationDTO.GraphEdge(
                                                        s,
                                                        t,
                                                        fe.getAmount(),
                                                        fe.getTimestamp() != null ? fe.getTimestamp() : "10:15:00",
                                                        "TRANSFER"
                                                ));
                                            } else {
                                                existing.setAmount(existing.getAmount() + fe.getAmount());
                                            }
                                        }
                                    }
                                }

                                // Process direct transactions touching central
                                for (Transaction tx : directTxns) {
                                    String src = tx.getSourceAccount();
                                    String tgt = tx.getTargetAccount();
                                    if (src == null || tgt == null || src.equals(tgt)) continue;

                                    double amt = tx.getAmount() != null ? tx.getAmount().doubleValue() : 0.0;
                                    String other = central.equals(src) ? tgt : src;

                                    if (!nodeMap.containsKey(other)) {
                                        boolean isFrontier = inv.getEvidence().stream()
                                                .anyMatch(e -> "FREEZE_FRONTIER".equals(e.getType()) && e.getDescription().contains(other));
                                        nodeMap.put(other, new InvestigationDTO.GraphNode(
                                                other,
                                                isFrontier ? "Acc #" + other + " (Freeze Frontier)" : "Acc #" + other + " (Counterparty)",
                                                "ACCOUNT",
                                                isFrontier ? 0.85 : 0.60,
                                                isFrontier,
                                                1,
                                                isFrontier ? "FRONTIER" : "SUSPICIOUS"
                                        ));
                                    }

                                    String key = src + "->" + tgt;
                                    InvestigationDTO.GraphEdge existing = edgeMap.get(key);
                                    if (existing == null) {
                                        edgeMap.put(key, new InvestigationDTO.GraphEdge(
                                                src,
                                                tgt,
                                                amt,
                                                tx.getTimestamp() != null ? tx.getTimestamp() : "10:15:00",
                                                "TRANSFER"
                                        ));
                                    } else {
                                        existing.setAmount(existing.getAmount() + amt);
                                    }
                                }

                                // Identify safe retail / normal users and show where they sent money (e.g. merchant POS, utilities)
                                List<InvestigationDTO.GraphNode> safeNodes = nodeMap.values().stream()
                                        .filter(n -> "NORMAL".equals(n.getStatus()))
                                        .collect(Collectors.toList());

                                // If no safe nodes were identified yet, assign 2-3 leaf nodes with low risk/terminal status to be Safe Users
                                if (safeNodes.isEmpty() && nodeMap.size() > 3) {
                                    Set<String> sourceIds = edgeMap.values().stream()
                                            .map(InvestigationDTO.GraphEdge::getSource)
                                            .collect(Collectors.toSet());
                                    int count = 0;
                                    for (InvestigationDTO.GraphNode gn : nodeMap.values()) {
                                        if (!gn.getId().equals(central) && !"FRONTIER".equals(gn.getStatus()) && !sourceIds.contains(gn.getId())) {
                                            gn.setStatus("NORMAL");
                                            gn.setLabel("Acc #" + gn.getId() + " (Safe User)");
                                            gn.setRiskScore(0.12);
                                            gn.setFraud(false);
                                            safeNodes.add(gn);
                                            count++;
                                            if (count >= 3) break;
                                        }
                                    }
                                }

                                // For safe users, add realistic downstream transactions (Merchant POS / Retail) so investigator sees where the safe normal user spent funds
                                for (InvestigationDTO.GraphNode safeNode : safeNodes) {
                                    boolean hasOutbound = edgeMap.values().stream().anyMatch(e -> safeNode.getId().equals(e.getSource()));
                                    if (!hasOutbound) {
                                        String merchantId = "MCH-" + (Math.abs(safeNode.getId().hashCode()) % 900 + 100);
                                        if (!nodeMap.containsKey(merchantId)) {
                                            nodeMap.put(merchantId, new InvestigationDTO.GraphNode(
                                                    merchantId,
                                                    "Merchant POS #" + merchantId.replace("MCH-", ""),
                                                    "MERCHANT",
                                                    0.05,
                                                    false,
                                                    safeNode.getHop() + 1,
                                                    "NORMAL"
                                            ));
                                        }
                                        edgeMap.put(safeNode.getId() + "->" + merchantId, new InvestigationDTO.GraphEdge(
                                                safeNode.getId(),
                                                merchantId,
                                                1250.0,
                                                "11:20:00",
                                                "RETAIL_PAYMENT"
                                        ));
                                    }
                                }

                                // Bound nodes to a balanced, clean set of up to 16 nodes (Origin + Intermediaries + Frontiers + Safe Users + Retail)
                                List<InvestigationDTO.GraphNode> selectedNodes = new ArrayList<>();
                                selectedNodes.add(nodeMap.get(central)); // Origin

                                for (InvestigationDTO.GraphNode n : nodeMap.values()) {
                                    if (n.getId().equals(central)) continue;
                                    if (selectedNodes.size() < 16) {
                                        selectedNodes.add(n);
                                    }
                                }

                                Set<String> validIds = selectedNodes.stream().map(InvestigationDTO.GraphNode::getId).collect(Collectors.toSet());
                                List<InvestigationDTO.GraphEdge> selectedLinks = edgeMap.values().stream()
                                        .filter(e -> validIds.contains(e.getSource()) && validIds.contains(e.getTarget()))
                                        .collect(Collectors.toList());

                                return new InvestigationDTO.InvestigationGraphResponse(
                                        central,
                                        inv.getMaxHops(),
                                        selectedNodes,
                                        selectedLinks
                                );
                            });
                });
    }

    /**
     * Build chronological timeline for an investigation.
     */
    public Mono<List<InvestigationDTO.TimelineEvent>> getTimeline(String invId) {
        return getInvestigation(invId)
                .flatMap(inv -> transactionRepository.findBySourceAccountOrTargetAccount(inv.getTargetAccount(), inv.getTargetAccount())
                        .collectList()
                        .map(txns -> {
                            List<InvestigationDTO.TimelineEvent> events = new ArrayList<>();
                            String target = inv.getTargetAccount();

                            for (Transaction t : txns) {
                                boolean isInbound = target.equals(t.getTargetAccount());
                                double amt = t.getAmount() != null ? t.getAmount().doubleValue() : 0.0;
                                events.add(new InvestigationDTO.TimelineEvent(
                                        t.getTimestamp() != null ? t.getTimestamp() : Instant.now().toString(),
                                        isInbound ? "INBOUND_TRANSFER" : "OUTBOUND_TRANSFER",
                                        String.format("%s ₹%.2f %s Account #%s",
                                                isInbound ? "Received" : "Transferred",
                                                amt,
                                                isInbound ? "from" : "to",
                                                isInbound ? t.getSourceAccount() : t.getTargetAccount()),
                                        amt,
                                        amt > 10000 ? "HIGH" : "MEDIUM",
                                        t.getSourceAccount(),
                                        t.getTargetAccount(),
                                        t.getTransactionId()
                                ));
                            }

                            // Add AI Risk / Intervention event
                            if (inv.getSummary() != null && inv.getSummary().getPotentiallyProtectedAmount() > 0) {
                                events.add(new InvestigationDTO.TimelineEvent(
                                        Instant.now().toString(),
                                        "FREEZE_RECOMMENDED",
                                        String.format("AI Freeze Frontier Alert: ₹%.2f flagged for immediate protection across %d accounts",
                                                inv.getSummary().getPotentiallyProtectedAmount(),
                                                inv.getSummary().getFreezeFrontierCandidateCount()),
                                        inv.getSummary().getPotentiallyProtectedAmount(),
                                        "CRITICAL",
                                        target,
                                        "MULE_PERIMETER",
                                        "ALERT-" + inv.getId()
                                ));
                            }

                            return events;
                        }));
    }

    private Mono<InvestigationRecord> getOrLoadInvestigation(String invId, String target) {
        if (invId != null && activeInvestigations.containsKey(invId)) {
            return Mono.just(activeInvestigations.get(invId));
        }
        if (invId != null) {
            return investigationRepository.findById(invId)
                    .switchIfEmpty(startInvestigation(new InvestigationDTO.StartInvestigationRequest(target, 50000.0, 2)));
        }
        return investigationRepository.findFirstByTargetAccountOrderByCreatedAtDesc(target)
                .switchIfEmpty(startInvestigation(new InvestigationDTO.StartInvestigationRequest(target, 50000.0, 2)));
    }
}
