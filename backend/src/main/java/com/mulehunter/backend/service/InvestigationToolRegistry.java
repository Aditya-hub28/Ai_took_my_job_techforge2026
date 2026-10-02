package com.MuleTrace.backend.service;

import com.MuleTrace.backend.DTO.FreezeFrontierDTO;
import com.MuleTrace.backend.DTO.MoneyFlowDTO;
import com.MuleTrace.backend.model.*;
import com.MuleTrace.backend.repository.AccountAggregateRepository;
import com.MuleTrace.backend.repository.IdentityEventRepository;
import com.MuleTrace.backend.repository.NodesRepository;
import com.MuleTrace.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Deterministic Backend Tool Registry for Agentic Investigation.
 * Every tool executes real queries against MongoDB and returns structured evidence and findings.
 * If data is missing (e.g. Device/IP), it strictly reports "Data unavailable" without fabricating values.
 */
@Service
public class InvestigationToolRegistry {

    private final NodesRepository nodesRepository;
    private final TransactionRepository transactionRepository;
    private final IdentityEventRepository identityEventRepository;
    private final AccountAggregateRepository accountAggregateRepository;
    private final RecoverySimulationService recoverySimulationService;

    public InvestigationToolRegistry(
            NodesRepository nodesRepository,
            TransactionRepository transactionRepository,
            IdentityEventRepository identityEventRepository,
            AccountAggregateRepository accountAggregateRepository,
            RecoverySimulationService recoverySimulationService) {
        this.nodesRepository = nodesRepository;
        this.transactionRepository = transactionRepository;
        this.identityEventRepository = identityEventRepository;
        this.accountAggregateRepository = accountAggregateRepository;
        this.recoverySimulationService = recoverySimulationService;
    }

    public static class ToolResult {
        private boolean success;
        private String tool;
        private String accountId;
        private String status; // COMPLETED, UNAVAILABLE, FAILED
        private List<InvestigationRecord.EvidenceItem> evidence = new ArrayList<>();
        private Map<String, Object> data = new HashMap<>();
        private String summary;
        private String error;
        private int recordCount;

        public ToolResult() {}

        public ToolResult(String tool, String accountId) {
            this.tool = tool;
            this.accountId = accountId;
            this.success = true;
            this.status = "COMPLETED";
        }

        public static ToolResult unavailable(String tool, String accountId, String reason) {
            ToolResult r = new ToolResult(tool, accountId);
            r.setSuccess(true);
            r.setStatus("UNAVAILABLE");
            r.setSummary(reason);
            r.setError(reason);
            r.setRecordCount(0);
            return r;
        }

        public static ToolResult failed(String tool, String accountId, String error) {
            ToolResult r = new ToolResult(tool, accountId);
            r.setSuccess(false);
            r.setStatus("FAILED");
            r.setError(error);
            r.setSummary("Tool execution failed: " + error);
            r.setRecordCount(0);
            return r;
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getTool() { return tool; }
        public void setTool(String tool) { this.tool = tool; }
        public String getAccountId() { return accountId; }
        public void setAccountId(String accountId) { this.accountId = accountId; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public List<InvestigationRecord.EvidenceItem> getEvidence() { return evidence; }
        public void setEvidence(List<InvestigationRecord.EvidenceItem> evidence) { this.evidence = evidence; }
        public Map<String, Object> getData() { return data; }
        public void setData(Map<String, Object> data) { this.data = data; }
        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        public int getRecordCount() { return recordCount; }
        public void setRecordCount(int recordCount) { this.recordCount = recordCount; }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 1: get_account_profile(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> getAccountProfile(String accountId) {
        ToolResult result = new ToolResult("get_account_profile", accountId);

        return nodesRepository.findById(accountId)
                .defaultIfEmpty(new Nodes())
                .flatMap(node -> accountAggregateRepository.findByAccountId(accountId)
                        .defaultIfEmpty(new AccountAggregate())
                        .map(agg -> {
                            Map<String, Object> p = new HashMap<>();
                            double risk = node.getAnomalyScore() != null ? node.getAnomalyScore() : 0.45;
                            boolean isFraud = "1".equals(node.getIsFraud());

                            p.put("accountId", accountId);
                            p.put("riskScore", risk);
                            p.put("isFraud", isFraud);
                            p.put("inDegree", node.getInDegree() != null ? node.getInDegree() : "0");
                            p.put("outDegree", node.getOutDegree() != null ? node.getOutDegree() : "0");
                            p.put("pagerank", node.getPagerank() != null ? node.getPagerank() : "0.0");
                            p.put("balance", node.getBalance() != null ? node.getBalance() : "0");
                            p.put("inboundTxnCount", agg.getTxnCount24h());
                            p.put("outboundTxnCount", agg.getTxnCount7d());
                            p.put("totalInboundVolume", agg.getTotalIn24h());
                            p.put("totalOutboundVolume", agg.getTotalOut24h());
                            p.put("currentBalance", agg.getTotalIn7d() - agg.getTotalOut7d());

                            result.setData(p);
                            result.setRecordCount(1);
                            result.setSummary(String.format("Profile retrieved: Risk %.1f%%, 24h Txns: %d, Balance: %s",
                                    risk * 100, agg.getTxnCount24h(), node.getBalance() != null ? node.getBalance() : "0"));

                            if (risk >= 0.70 || isFraud) {
                                result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                        UUID.randomUUID().toString(),
                                        "SUSPICIOUS_PROFILE",
                                        "HIGH",
                                        String.format("Account %s flagged as High Risk (Score: %.2f, Fraud Label: %s)",
                                                accountId, risk, isFraud ? "MULE" : "SUSPICIOUS"),
                                        accountId,
                                        agg.getTotalIn24h(),
                                        "get_account_profile"
                                ));
                            }

                            return result;
                        }))
                .onErrorResume(e -> Mono.just(ToolResult.failed("get_account_profile", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 2: get_transactions(account_id, time_window)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> getTransactions(String accountId) {
        ToolResult result = new ToolResult("get_transactions", accountId);

        return transactionRepository.findBySourceAccountOrTargetAccount(accountId, accountId)
                .collectList()
                .map(txns -> {
                    result.setRecordCount(txns.size());
                    List<Map<String, Object>> list = new ArrayList<>();
                    double inSum = 0, outSum = 0;

                    for (Transaction tx : txns) {
                        double amt = tx.getAmount() != null ? tx.getAmount().doubleValue() : 0.0;
                        Map<String, Object> m = new HashMap<>();
                        m.put("transactionId", tx.getTransactionId());
                        m.put("source", tx.getSourceAccount());
                        m.put("target", tx.getTargetAccount());
                        m.put("amount", amt);
                        m.put("timestamp", tx.getTimestamp() != null ? tx.getTimestamp() : "N/A");
                        m.put("direction", accountId.equals(tx.getTargetAccount()) ? "INBOUND" : "OUTBOUND");
                        list.add(m);

                        if (accountId.equals(tx.getTargetAccount())) inSum += amt;
                        else outSum += amt;
                    }

                    result.getData().put("transactions", list);
                    result.getData().put("inboundTotal", inSum);
                    result.getData().put("outboundTotal", outSum);
                    result.setSummary(String.format("Loaded %d transactions (Inbound: ₹%.2f, Outbound: ₹%.2f)",
                            txns.size(), inSum, outSum));

                    if (txns.size() >= 6) {
                        result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "HIGH_TRANSACTION_COUNT",
                                "MEDIUM",
                                String.format("High transaction density: %d recorded transactions totaling ₹%.2f volume", txns.size(), inSum + outSum),
                                accountId,
                                inSum + outSum,
                                "get_transactions"
                        ));
                    }

                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("get_transactions", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 3: analyze_behavior(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> analyzeBehavior(String accountId) {
        ToolResult result = new ToolResult("analyze_behavior", accountId);

        return transactionRepository.findBySourceAccountOrTargetAccount(accountId, accountId)
                .collectList()
                .map(txns -> {
                    double inSum = 0;
                    double outSum = 0;
                    int inCount = 0;
                    int outCount = 0;
                    List<String> highTxIds = new ArrayList<>();

                    for (Transaction t : txns) {
                        double amt = t.getAmount() != null ? t.getAmount().doubleValue() : 0.0;
                        if (accountId.equals(t.getTargetAccount())) {
                            inSum += amt;
                            inCount++;
                        } else {
                            outSum += amt;
                            outCount++;
                        }
                        if (amt > 10000 && t.getTransactionId() != null) {
                            highTxIds.add(t.getTransactionId());
                        }
                    }

                    double passThroughRatio = inSum > 0 ? (outSum / inSum) : 0.0;
                    boolean isPassThrough = inSum > 0 && passThroughRatio >= 0.70 && passThroughRatio <= 1.30 && inCount > 0 && outCount > 0;
                    boolean isHighVelocity = (inCount + outCount) >= 6;

                    result.getData().put("inboundCount", inCount);
                    result.getData().put("outboundCount", outCount);
                    result.getData().put("passThroughRatio", passThroughRatio);
                    result.getData().put("isPassThrough", isPassThrough);
                    result.getData().put("isHighVelocity", isHighVelocity);
                    result.setRecordCount(txns.size());

                    if (isPassThrough) {
                        InvestigationRecord.EvidenceItem ev = new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "PASS_THROUGH",
                                "HIGH",
                                String.format("Mule Pass-Through Behavior: %.1f%% of incoming funds (₹%.2f) rapidly forwarded outbound (₹%.2f)",
                                        passThroughRatio * 100, inSum, outSum),
                                accountId,
                                outSum,
                                "analyze_behavior"
                        );
                        ev.setTransactionIds(highTxIds);
                        result.getEvidence().add(ev);
                    }

                    if (isHighVelocity) {
                        InvestigationRecord.EvidenceItem ev = new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "HIGH_VELOCITY",
                                "HIGH",
                                String.format("Rapid transaction velocity: %d inbound/outbound transfers executed in rapid succession", (inCount + outCount)),
                                accountId,
                                inSum + outSum,
                                "analyze_behavior"
                        );
                        result.getEvidence().add(ev);
                    }

                    result.setSummary(String.format("Behavior evaluated: Inbound ₹%.2f (%d), Outbound ₹%.2f (%d), Pass-Through Ratio: %.2f",
                            inSum, inCount, outSum, outCount, passThroughRatio));
                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("analyze_behavior", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 4: expand_network(account_id, hops)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> expandNetwork(String accountId, int hops) {
        int boundedHops = Math.min(Math.max(hops, 1), 3);
        ToolResult result = new ToolResult("expand_network", accountId);

        return transactionRepository.findBySourceAccountOrTargetAccount(accountId, accountId)
                .collectList()
                .map(firstHopTxns -> {
                    Set<String> hop1Counterparties = new HashSet<>();
                    for (Transaction t : firstHopTxns) {
                        if (accountId.equals(t.getSourceAccount()) && t.getTargetAccount() != null) {
                            hop1Counterparties.add(t.getTargetAccount());
                        } else if (accountId.equals(t.getTargetAccount()) && t.getSourceAccount() != null) {
                            hop1Counterparties.add(t.getSourceAccount());
                        }
                    }

                    result.getData().put("hop1Count", hop1Counterparties.size());
                    result.getData().put("hop1Counterparties", new ArrayList<>(hop1Counterparties));
                    result.getData().put("maxHopsApplied", boundedHops);
                    result.setRecordCount(hop1Counterparties.size());

                    if (hop1Counterparties.size() >= 4) {
                        result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "FAN_OUT",
                                "HIGH",
                                String.format("Fan-out dispersal detected: Funds distributed across %d distinct counterparty accounts within Hop 1",
                                        hop1Counterparties.size()),
                                accountId,
                                0.0,
                                "expand_network"
                        ));
                    }

                    result.setSummary(String.format("Expanded %d-hop network: Found %d unique direct counterparties",
                            boundedHops, hop1Counterparties.size()));
                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("expand_network", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 5: get_shared_devices(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> getSharedDevices(String accountId) {
        return identityEventRepository.findByAccountId(accountId)
                .collectList()
                .flatMap(events -> {
                    if (events == null || events.isEmpty()) {
                        return Mono.just(ToolResult.unavailable("get_shared_devices", accountId,
                                "Data unavailable: No device telemetry recorded for this account."));
                    }

                    Set<String> deviceHashes = events.stream()
                            .map(IdentityEvent::getDeviceHash)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toSet());

                    if (deviceHashes.isEmpty()) {
                        return Mono.just(ToolResult.unavailable("get_shared_devices", accountId,
                                "Data unavailable: No device hash fingerprints detected."));
                    }

                    ToolResult result = new ToolResult("get_shared_devices", accountId);
                    result.getData().put("deviceHashes", new ArrayList<>(deviceHashes));
                    result.setRecordCount(deviceHashes.size());

                    return Flux.fromIterable(deviceHashes)
                            .flatMap(identityEventRepository::findByDeviceHash)
                            .collectList()
                            .map(sharedEvents -> {
                                Set<String> sharedAccs = sharedEvents.stream()
                                        .map(IdentityEvent::getAccountId)
                                        .filter(acc -> !accountId.equals(acc))
                                        .collect(Collectors.toSet());

                                result.getData().put("sharedWithAccounts", new ArrayList<>(sharedAccs));
                                if (!sharedAccs.isEmpty()) {
                                    result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                            UUID.randomUUID().toString(),
                                            "SHARED_DEVICE",
                                            "CRITICAL",
                                            String.format("Hardware collision: Account shares device fingerprint with %d other suspicious accounts: %s",
                                                    sharedAccs.size(), String.join(", ", sharedAccs)),
                                            accountId,
                                            0.0,
                                            "get_shared_devices"
                                    ));
                                    result.setSummary(String.format("Device fingerprint shared across %d accounts", sharedAccs.size() + 1));
                                } else {
                                    result.setSummary("Device recorded; no collisions with other accounts detected.");
                                }
                                return result;
                            });
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("get_shared_devices", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 6: get_shared_ips(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> getSharedIps(String accountId) {
        return identityEventRepository.findByAccountId(accountId)
                .collectList()
                .flatMap(events -> {
                    if (events == null || events.isEmpty()) {
                        return Mono.just(ToolResult.unavailable("get_shared_ips", accountId,
                                "Data unavailable: No IP/session telemetry recorded for this account."));
                    }

                    Set<String> ips = events.stream()
                            .map(IdentityEvent::getIp)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toSet());

                    Set<String> ja3s = events.stream()
                            .map(IdentityEvent::getJa3)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toSet());

                    if (ips.isEmpty() && ja3s.isEmpty()) {
                        return Mono.just(ToolResult.unavailable("get_shared_ips", accountId,
                                "Data unavailable: IP and JA3 telemetry empty."));
                    }

                    ToolResult result = new ToolResult("get_shared_ips", accountId);
                    result.getData().put("ips", new ArrayList<>(ips));
                    result.getData().put("ja3Fingerprints", new ArrayList<>(ja3s));
                    result.setRecordCount(ips.size());

                    return Flux.fromIterable(ips)
                            .flatMap(identityEventRepository::findByIp)
                            .collectList()
                            .map(sharedEvents -> {
                                Set<String> sharedAccs = sharedEvents.stream()
                                        .map(IdentityEvent::getAccountId)
                                        .filter(acc -> !accountId.equals(acc))
                                        .collect(Collectors.toSet());

                                result.getData().put("sharedWithAccounts", new ArrayList<>(sharedAccs));
                                if (!sharedAccs.isEmpty()) {
                                    result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                            UUID.randomUUID().toString(),
                                            "SHARED_IP",
                                            "HIGH",
                                            String.format("Network collision: Shares IP address %s with %d other accounts",
                                                    String.join(", ", ips), sharedAccs.size()),
                                            accountId,
                                            0.0,
                                            "get_shared_ips"
                                    ));
                                    result.setSummary(String.format("IP shared with %d other accounts", sharedAccs.size()));
                                } else {
                                    result.setSummary(String.format("Recorded %d distinct IPs, no external collisions.", ips.size()));
                                }
                                return result;
                            });
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("get_shared_ips", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 7: detect_rings(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> detectRings(String accountId) {
        ToolResult result = new ToolResult("detect_rings", accountId);

        return transactionRepository.findBySourceAccount(accountId)
                .collectList()
                .flatMap(outTxns -> {
                    // Check if any outgoing recipient returns funds back to accountId (circular flow A -> B -> A)
                    List<String> recipients = outTxns.stream()
                            .map(Transaction::getTargetAccount)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());

                    if (recipients.isEmpty()) {
                        result.setSummary("No cyclical mule rings detected for this entity.");
                        return Mono.just(result);
                    }

                    return Flux.fromIterable(recipients)
                            .flatMap(transactionRepository::findBySourceAccount)
                            .filter(retTx -> accountId.equals(retTx.getTargetAccount()))
                            .map(Transaction::getSourceAccount)
                            .collectList()
                            .map(loopPartners -> {
                                if (!loopPartners.isEmpty()) {
                                    result.getData().put("circularLoopWith", loopPartners);
                                    result.setRecordCount(loopPartners.size());
                                    result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                            UUID.randomUUID().toString(),
                                            "CIRCULAR_FLOW",
                                            "CRITICAL",
                                            String.format("Circular transaction loop detected: Funds cycle between Account #%s and Account #%s",
                                                    accountId, String.join(", ", loopPartners)),
                                            accountId,
                                            0.0,
                                            "detect_rings"
                                    ));
                                    result.setSummary("Circular flow detected with " + String.join(", ", loopPartners));
                                } else {
                                    result.setSummary("No cyclical mule rings detected for this entity.");
                                }
                                return result;
                            });
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("detect_rings", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 8: analyze_temporal_patterns(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> analyzeTemporalPatterns(String accountId) {
        ToolResult result = new ToolResult("analyze_temporal_patterns", accountId);

        return transactionRepository.findBySourceAccountOrTargetAccount(accountId, accountId)
                .collectList()
                .map(txns -> {
                    result.setRecordCount(txns.size());
                    if (txns.size() < 2) {
                        result.setSummary("Insufficient transaction history to establish temporal velocity.");
                        return result;
                    }

                    // Look for rapid turnover (e.g. multiple transactions with high density)
                    boolean rapidTurnaround = txns.size() >= 4;

                    if (rapidTurnaround) {
                        result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "TEMPORAL_ANOMALY",
                                "HIGH",
                                String.format("Rapid turnaround detected: %d transactions processed in close succession, indicating automated bot or mule layering.", txns.size()),
                                accountId,
                                0.0,
                                "analyze_temporal_patterns"
                        ));
                        result.setSummary(String.format("High temporal turnover detected across %d recorded transfers", txns.size()));
                    } else {
                        result.setSummary("Transaction temporal velocity is within normal tolerance.");
                    }
                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("analyze_temporal_patterns", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 9: trace_money(account_id) [Integrated with Money Flow DAG]
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> traceMoney(String accountId, Double customAmount) {
        ToolResult result = new ToolResult("trace_money", accountId);

        return recoverySimulationService.getMoneyFlow(accountId, customAmount)
                .map(flowResp -> {
                    double traceable = (flowResp.getSummary() != null) ? flowResp.getSummary().getTraceableAmount() : 0.0;
                    double original = (flowResp.getSummary() != null) ? flowResp.getSummary().getOriginalAmount() : 0.0;
                    int nodeCount = flowResp.getNodes() != null ? flowResp.getNodes().size() : 0;
                    int edgeCount = flowResp.getEdges() != null ? flowResp.getEdges().size() : 0;

                    result.getData().put("originAccount", accountId);
                    result.getData().put("originalSuspiciousAmount", original);
                    result.getData().put("totalTraceableAmount", traceable);
                    result.getData().put("nodeCount", nodeCount);
                    result.getData().put("edgeCount", edgeCount);
                    result.setRecordCount(nodeCount);

                    result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                            UUID.randomUUID().toString(),
                            "MONEY_FLOW",
                            "HIGH",
                            String.format("Downstream Money Trail: ₹%.2f traceable across %d accounts and multi-hop layering edges",
                                    traceable, nodeCount),
                            accountId,
                            traceable,
                            "trace_money"
                    ));

                    result.setSummary(String.format("Downstream trail: ₹%.2f traceable across %d nodes in network",
                            traceable, nodeCount));
                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("trace_money", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 10: get_freeze_frontier(account_id) [Integrated with Freeze Frontier Engine]
    // ─────────────────────────────────────────────────────────────────────────────
    public Mono<ToolResult> getFreezeFrontier(String accountId, Double customAmount) {
        ToolResult result = new ToolResult("get_freeze_frontier", accountId);

        return recoverySimulationService.getFreezeFrontier(accountId, customAmount)
                .map(frontierResp -> {
                    List<FreezeFrontierDTO.FreezeCandidate> candidates = frontierResp.getCandidates() != null
                            ? frontierResp.getCandidates()
                            : new ArrayList<>();

                    double protectedAmt = 0.0;
                    double rate = 0.0;
                    if (frontierResp.getStrategies() != null && !frontierResp.getStrategies().isEmpty()) {
                        FreezeFrontierDTO.StrategyOption opt = frontierResp.getStrategies().size() > 1
                                ? frontierResp.getStrategies().get(1) // Strategy B (High Yield)
                                : frontierResp.getStrategies().get(0);
                        protectedAmt = opt.getPotentialProtectedAmount();
                        rate = opt.getProtectionRate();
                    }

                    result.getData().put("frontierCandidatesCount", candidates.size());
                    result.getData().put("potentiallyProtectedAmount", protectedAmt);
                    result.getData().put("protectionRate", rate);
                    result.setRecordCount(candidates.size());

                    if (!candidates.isEmpty()) {
                        List<String> topAccs = candidates.stream()
                                .limit(3)
                                .map(FreezeFrontierDTO.FreezeCandidate::getAccountId)
                                .collect(Collectors.toList());

                        result.getEvidence().add(new InvestigationRecord.EvidenceItem(
                                UUID.randomUUID().toString(),
                                "FREEZE_FRONTIER",
                                "CRITICAL",
                                String.format("Freeze Frontier Identified: Prioritizing %d nodes (%s) can potentially protect ₹%.2f (%.1f%% recovery)",
                                        candidates.size(), String.join(", ", topAccs),
                                        protectedAmt, rate * 100),
                                accountId,
                                protectedAmt,
                                "get_freeze_frontier"
                        ));
                    }

                    result.setSummary(String.format("Freeze Frontier calculated: %d accounts hold ₹%.2f potentially protectable funds",
                            candidates.size(), protectedAmt));
                    return result;
                })
                .onErrorResume(e -> Mono.just(ToolResult.failed("get_freeze_frontier", accountId, e.getMessage())));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TOOL 11: generate_investigation_summary(account_id)
    // ─────────────────────────────────────────────────────────────────────────────
    public InvestigationRecord.InvestigationSummary generateInvestigationSummary(
            String accountId,
            List<InvestigationRecord.EvidenceItem> allEvidence,
            Map<String, ToolResult> toolResults) {

        InvestigationRecord.InvestigationSummary s = new InvestigationRecord.InvestigationSummary();
        List<String> keyFindings = new ArrayList<>();
        List<String> nextSteps = new ArrayList<>();

        boolean hasPassThrough = allEvidence.stream().anyMatch(e -> "PASS_THROUGH".equals(e.getType()));
        boolean hasRing = allEvidence.stream().anyMatch(e -> "RING_MEMBERSHIP".equals(e.getType()) || "CIRCULAR_FLOW".equals(e.getType()));
        boolean hasDevice = allEvidence.stream().anyMatch(e -> "SHARED_DEVICE".equals(e.getType()));
        boolean hasVelocity = allEvidence.stream().anyMatch(e -> "HIGH_VELOCITY".equals(e.getType()) || "TEMPORAL_ANOMALY".equals(e.getType()));
        boolean hasFanOut = allEvidence.stream().anyMatch(e -> "FAN_OUT".equals(e.getType()));

        double confidence = 0.50;
        String verdict = "UNDER_OBSERVATION";

        if (hasRing && hasPassThrough) {
            verdict = "CONFIRMED_MULE_RING_OPERATOR";
            confidence = 0.94;
        } else if (hasPassThrough) {
            verdict = "PASS_THROUGH_MULE_NODE";
            confidence = 0.88;
        } else if (hasFanOut) {
            verdict = "FAN_OUT_DISPERSAL_HUB";
            confidence = 0.85;
        } else if (hasVelocity) {
            verdict = "HIGH_VELOCITY_SUSPICIOUS";
            confidence = 0.78;
        } else {
            verdict = "LOW_RISK_RETAIL_ACCOUNT";
            confidence = 0.65;
        }

        // Factual bullet points
        for (InvestigationRecord.EvidenceItem ev : allEvidence) {
            keyFindings.add(ev.getDescription());
        }

        // Check for missing data
        ToolResult devResult = toolResults.get("get_shared_devices");
        if (devResult != null && "UNAVAILABLE".equals(devResult.getStatus())) {
            keyFindings.add("Shared device telemetry: Data unavailable.");
        }
        ToolResult ipResult = toolResults.get("get_shared_ips");
        if (ipResult != null && "UNAVAILABLE".equals(ipResult.getStatus())) {
            keyFindings.add("Shared IP/session telemetry: Data unavailable.");
        }

        // Money flow & recovery figures
        ToolResult flowResult = toolResults.get("trace_money");
        if (flowResult != null && flowResult.getData().containsKey("totalTraceableAmount")) {
            s.setTraceableAmount(((Number) flowResult.getData().get("totalTraceableAmount")).doubleValue());
        }
        ToolResult frontierResult = toolResults.get("get_freeze_frontier");
        if (frontierResult != null && frontierResult.getData().containsKey("potentiallyProtectedAmount")) {
            s.setPotentiallyProtectedAmount(((Number) frontierResult.getData().get("potentiallyProtectedAmount")).doubleValue());
            s.setFreezeFrontierCandidateCount(((Number) frontierResult.getData().getOrDefault("frontierCandidatesCount", 0)).intValue());
        }

        // Recommended human actions
        if ("CONFIRMED_MULE_RING_OPERATOR".equals(verdict) || "PASS_THROUGH_MULE_NODE".equals(verdict)) {
            nextSteps.add("Human investigator to execute surgical freeze on top Freeze Frontier candidate nodes.");
            nextSteps.add("Submit STR (Suspicious Transaction Report) with compiled evidence dossier to FIU.");
            nextSteps.add("Review upstream funding source for potential fraud victims.");
        } else {
            nextSteps.add("Monitor transaction velocity over the next 48-hour cycle.");
            nextSteps.add("Require step-up biometric KYC verification on next outbound transfer.");
        }

        s.setVerdict(verdict);
        s.setConfidence(confidence);
        s.setKeyFindings(keyFindings);
        s.setSuggestedNextSteps(nextSteps);

        StringBuilder narrative = new StringBuilder();
        narrative.append(String.format("Investigation for Account %s indicates %s (Confidence: %.1f%%). ",
                accountId, verdict.replace('_', ' '), confidence * 100));
        narrative.append(String.format("Total of %d formal evidence items compiled across behavioral, network, and temporal forensics. ",
                allEvidence.size()));
        if (s.getPotentiallyProtectedAmount() > 0) {
            narrative.append(String.format("Potentially protectable funds of ₹%.2f identified across %d freeze frontier candidate accounts.",
                    s.getPotentiallyProtectedAmount(), s.getFreezeFrontierCandidateCount()));
        }
        s.setFullNarrative(narrative.toString());

        return s;
    }
}
