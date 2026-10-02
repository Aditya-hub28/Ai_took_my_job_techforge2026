package com.MuleTrace.backend.DTO;

import com.MuleTrace.backend.model.InvestigationRecord;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class InvestigationDTO {

    public static class StartInvestigationRequest {
        private String targetAccount;
        private Double customAmount;
        private Integer maxHops = 2;

        public StartInvestigationRequest() {}
        public StartInvestigationRequest(String targetAccount, Double customAmount, Integer maxHops) {
            this.targetAccount = targetAccount;
            this.customAmount = customAmount;
            this.maxHops = maxHops;
        }

        public String getTargetAccount() { return targetAccount; }
        public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }
        public Double getCustomAmount() { return customAmount; }
        public void setCustomAmount(Double customAmount) { this.customAmount = customAmount; }
        public Integer getMaxHops() { return maxHops; }
        public void setMaxHops(Integer maxHops) { this.maxHops = maxHops; }
    }

    public static class InvestigationQueryRequest {
        private String investigationId;
        private String targetAccount;
        private String query;

        public InvestigationQueryRequest() {}
        public InvestigationQueryRequest(String investigationId, String targetAccount, String query) {
            this.investigationId = investigationId;
            this.targetAccount = targetAccount;
            this.query = query;
        }

        public String getInvestigationId() { return investigationId; }
        public void setInvestigationId(String investigationId) { this.investigationId = investigationId; }
        public String getTargetAccount() { return targetAccount; }
        public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }
        public String getQuery() { return query; }
        public void setQuery(String query) { this.query = query; }
    }

    public static class InvestigationQueryResponse {
        private String query;
        private String matchedIntent;
        private List<String> executedTools = new ArrayList<>();
        private String answer;
        private List<InvestigationRecord.EvidenceItem> evidenceCited = new ArrayList<>();
        private List<String> suggestedNextSteps = new ArrayList<>();
        private boolean success;

        public InvestigationQueryResponse() {}

        public String getQuery() { return query; }
        public void setQuery(String query) { this.query = query; }
        public String getMatchedIntent() { return matchedIntent; }
        public void setMatchedIntent(String matchedIntent) { this.matchedIntent = matchedIntent; }
        public List<String> getExecutedTools() { return executedTools; }
        public void setExecutedTools(List<String> executedTools) { this.executedTools = executedTools; }
        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }
        public List<InvestigationRecord.EvidenceItem> getEvidenceCited() { return evidenceCited; }
        public void setEvidenceCited(List<InvestigationRecord.EvidenceItem> evidenceCited) { this.evidenceCited = evidenceCited; }
        public List<String> getSuggestedNextSteps() { return suggestedNextSteps; }
        public void setSuggestedNextSteps(List<String> suggestedNextSteps) { this.suggestedNextSteps = suggestedNextSteps; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
    }

    public static class InvestigationDecisionRequest {
        private String decision; // CONFIRMED, CLEARED, ESCALATED, UNDER_REVIEW
        private String investigatorName;
        private String note;

        public InvestigationDecisionRequest() {}
        public String getDecision() { return decision; }
        public void setDecision(String decision) { this.decision = decision; }
        public String getInvestigatorName() { return investigatorName; }
        public void setInvestigatorName(String investigatorName) { this.investigatorName = investigatorName; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    public static class GraphNode {
        private String id;
        private String label;
        private String type; // ACCOUNT, DEVICE, IP, MERCHANT
        private double riskScore;
        private boolean isFraud;
        private int hop;
        private String status; // NORMAL, SUSPICIOUS, FRONTIER, ORIGIN

        public GraphNode() {}
        public GraphNode(String id, String label, String type, double riskScore, boolean isFraud, int hop, String status) {
            this.id = id;
            this.label = label;
            this.type = type;
            this.riskScore = riskScore;
            this.isFraud = isFraud;
            this.hop = hop;
            this.status = status;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public double getRiskScore() { return riskScore; }
        public void setRiskScore(double riskScore) { this.riskScore = riskScore; }
        public boolean isFraud() { return isFraud; }
        public void setFraud(boolean fraud) { isFraud = fraud; }
        public int getHop() { return hop; }
        public void setHop(int hop) { this.hop = hop; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    public static class GraphEdge {
        private String source;
        private String target;
        private double amount;
        private String timestamp;
        private String type; // TRANSFER, SHARED_DEVICE, SHARED_IP

        public GraphEdge() {}
        public GraphEdge(String source, String target, double amount, String timestamp, String type) {
            this.source = source;
            this.target = target;
            this.amount = amount;
            this.timestamp = timestamp;
            this.type = type;
        }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }
        public double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount != null ? amount : 0.0; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
    }

    public static class InvestigationGraphResponse {
        private String centralAccount;
        private int maxHops;
        private List<GraphNode> nodes = new ArrayList<>();
        private List<GraphEdge> links = new ArrayList<>();

        public InvestigationGraphResponse() {}
        public InvestigationGraphResponse(String centralAccount, int maxHops, List<GraphNode> nodes, List<GraphEdge> links) {
            this.centralAccount = centralAccount;
            this.maxHops = maxHops;
            this.nodes = nodes;
            this.links = links;
        }

        public String getCentralAccount() { return centralAccount; }
        public void setCentralAccount(String centralAccount) { this.centralAccount = centralAccount; }
        public int getMaxHops() { return maxHops; }
        public void setMaxHops(int maxHops) { this.maxHops = maxHops; }
        public List<GraphNode> getNodes() { return nodes; }
        public void setNodes(List<GraphNode> nodes) { this.nodes = nodes; }
        public List<GraphEdge> getLinks() { return links; }
        public void setLinks(List<GraphEdge> links) { this.links = links; }
    }

    public static class TimelineEvent {
        private String timestamp;
        private String eventType; // INBOUND_TRANSFER, OUTBOUND_TRANSFER, VELOCITY_BURST, DEVICE_BIND, IP_ROTATE, RING_CYCLE, FREEZE_RECOMMENDED
        private String description;
        private double amount;
        private String severity;
        private String sourceAccount;
        private String targetAccount;
        private String transactionId;

        public TimelineEvent() {}
        public TimelineEvent(String timestamp, String eventType, String description, double amount, String severity, String sourceAccount, String targetAccount, String transactionId) {
            this.timestamp = timestamp;
            this.eventType = eventType;
            this.description = description;
            this.amount = amount;
            this.severity = severity;
            this.sourceAccount = sourceAccount;
            this.targetAccount = targetAccount;
            this.transactionId = transactionId;
        }

        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public String getEventType() { return eventType; }
        public void setEventType(String eventType) { this.eventType = eventType; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }
        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }
        public String getSourceAccount() { return sourceAccount; }
        public void setSourceAccount(String sourceAccount) { this.sourceAccount = sourceAccount; }
        public String getTargetAccount() { return targetAccount; }
        public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }
        public String getTransactionId() { return transactionId; }
        public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    }
}
