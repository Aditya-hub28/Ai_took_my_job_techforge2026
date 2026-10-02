package com.MuleTrace.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Persisted investigation session with full auditability and evidence trail.
 */
@Document(collection = "investigations")
public class InvestigationRecord {

    @Id
    private String id; // e.g. "INV-10004-9842"

    @Indexed
    private String targetAccount;

    private String status; // QUEUED, RUNNING, COMPLETED, FAILED, UNDER_REVIEW, CONFIRMED, CLEARED, ESCALATED
    private Instant createdAt;
    private Instant completedAt;

    private int maxHops = 2;
    private Double targetAmount;

    private List<StepTrace> steps = new ArrayList<>();
    private List<EvidenceItem> evidence = new ArrayList<>();
    private List<AuditAction> auditTrail = new ArrayList<>();
    private InvestigationSummary summary;
    private Map<String, Object> metadata;

    public InvestigationRecord() {
        this.createdAt = Instant.now();
        this.status = "QUEUED";
    }

    // --- Inner Classes ---

    public static class StepTrace {
        private String tool;
        private String status; // RUNNING, COMPLETED, FAILED, UNAVAILABLE
        private Instant startTime;
        private Instant completionTime;
        private long durationMs;
        private int recordCount;
        private String error;

        public StepTrace() {}

        public StepTrace(String tool, String status, Instant startTime, Instant completionTime, long durationMs, int recordCount, String error) {
            this.tool = tool;
            this.status = status;
            this.startTime = startTime;
            this.completionTime = completionTime;
            this.durationMs = durationMs;
            this.recordCount = recordCount;
            this.error = error;
        }

        public String getTool() { return tool; }
        public void setTool(String tool) { this.tool = tool; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public Instant getStartTime() { return startTime; }
        public void setStartTime(Instant startTime) { this.startTime = startTime; }
        public Instant getCompletionTime() { return completionTime; }
        public void setCompletionTime(Instant completionTime) { this.completionTime = completionTime; }
        public long getDurationMs() { return durationMs; }
        public void setDurationMs(long durationMs) { this.durationMs = durationMs; }
        public int getRecordCount() { return recordCount; }
        public void setRecordCount(int recordCount) { this.recordCount = recordCount; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }

    public static class EvidenceItem {
        private String id;
        private String type; // HIGH_VELOCITY, STRUCTURING, PASS_THROUGH, SHARED_DEVICE, SHARED_IP, SUSPICIOUS_COUNTERPARTY, RING_MEMBERSHIP, TEMPORAL_ANOMALY, MONEY_FLOW, MULTI_HOP_TRANSFER, FREEZE_FRONTIER
        private String severity; // LOW, MEDIUM, HIGH, CRITICAL
        private String description;
        private String accountId;
        private List<String> transactionIds = new ArrayList<>();
        private Double amount;
        private String timestamp;
        private String sourceTool;
        private Map<String, Object> details;

        public EvidenceItem() {}

        public EvidenceItem(String id, String type, String severity, String description, String accountId, Double amount, String sourceTool) {
            this.id = id;
            this.type = type;
            this.severity = severity;
            this.description = description;
            this.accountId = accountId;
            this.amount = amount;
            this.sourceTool = sourceTool;
            this.timestamp = Instant.now().toString();
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getAccountId() { return accountId; }
        public void setAccountId(String accountId) { this.accountId = accountId; }
        public List<String> getTransactionIds() { return transactionIds; }
        public void setTransactionIds(List<String> transactionIds) { this.transactionIds = transactionIds; }
        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getSourceTool() { return sourceTool; }
        public void setSourceTool(String sourceTool) { this.sourceTool = sourceTool; }
        public Map<String, Object> getDetails() { return details; }
        public void setDetails(Map<String, Object> details) { this.details = details; }
    }

    public static class AuditAction {
        private String action; // CREATED, TOOL_EXECUTED, EVIDENCE_ADDED, DECISION_RECORDED, ESCALATED, CLOSED
        private Instant timestamp;
        private String actor;
        private String note;

        public AuditAction() { this.timestamp = Instant.now(); }

        public AuditAction(String action, String actor, String note) {
            this.action = action;
            this.actor = actor;
            this.note = note;
            this.timestamp = Instant.now();
        }

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public Instant getTimestamp() { return timestamp; }
        public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
        public String getActor() { return actor; }
        public void setActor(String actor) { this.actor = actor; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    public static class InvestigationSummary {
        private String verdict; // HIGH_RISK_MULE, PASS_THROUGH_NODE, FAN_OUT_HUB, RING_OPERATOR, NORMAL_ACCOUNT, INSUFFICIENT_DATA
        private double confidence;
        private List<String> keyFindings = new ArrayList<>();
        private double traceableAmount;
        private double potentiallyProtectedAmount;
        private int freezeFrontierCandidateCount;
        private List<String> suggestedNextSteps = new ArrayList<>();
        private String fullNarrative;

        public InvestigationSummary() {}

        public String getVerdict() { return verdict; }
        public void setVerdict(String verdict) { this.verdict = verdict; }
        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
        public List<String> getKeyFindings() { return keyFindings; }
        public void setKeyFindings(List<String> keyFindings) { this.keyFindings = keyFindings; }
        public double getTraceableAmount() { return traceableAmount; }
        public void setTraceableAmount(double traceableAmount) { this.traceableAmount = traceableAmount; }
        public double getPotentiallyProtectedAmount() { return potentiallyProtectedAmount; }
        public void setPotentiallyProtectedAmount(double potentiallyProtectedAmount) { this.potentiallyProtectedAmount = potentiallyProtectedAmount; }
        public int getFreezeFrontierCandidateCount() { return freezeFrontierCandidateCount; }
        public void setFreezeFrontierCandidateCount(int count) { this.freezeFrontierCandidateCount = count; }
        public List<String> getSuggestedNextSteps() { return suggestedNextSteps; }
        public void setSuggestedNextSteps(List<String> steps) { this.suggestedNextSteps = steps; }
        public String getFullNarrative() { return narrative(); }
        public void setFullNarrative(String narrative) { this.fullNarrative = narrative; }

        private String narrative() { return fullNarrative; }
    }

    // --- Getters / Setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTargetAccount() { return targetAccount; }
    public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public int getMaxHops() { return maxHops; }
    public void setMaxHops(int maxHops) { this.maxHops = maxHops; }
    public Double getTargetAmount() { return targetAmount; }
    public void setTargetAmount(Double targetAmount) { this.targetAmount = targetAmount; }
    public List<StepTrace> getSteps() { return steps; }
    public void setSteps(List<StepTrace> steps) { this.steps = steps; }
    public List<EvidenceItem> getEvidence() { return evidence; }
    public void setEvidence(List<EvidenceItem> evidence) { this.evidence = evidence; }
    public List<AuditAction> getAuditTrail() { return auditTrail; }
    public void setAuditTrail(List<AuditAction> auditTrail) { this.auditTrail = auditTrail; }
    public InvestigationSummary getSummary() { return summary; }
    public void setSummary(InvestigationSummary summary) { this.summary = summary; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
}
