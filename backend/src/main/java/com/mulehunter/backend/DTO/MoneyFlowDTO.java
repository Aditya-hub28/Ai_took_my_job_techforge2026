package com.MuleTrace.backend.DTO;

import java.util.List;
import java.util.Map;

public class MoneyFlowDTO {

    public static class FlowNode {
        private String id;
        private String label;
        private double riskScore;
        private String role; // "ORIGIN", "HUB", "BRIDGE", "MULE", "FRONTIER", "TERMINAL"
        private double amountReceived;
        private double amountForwarded;
        private double amountRetained;
        private int hop;
        private boolean isOrigin;
        private boolean isFrontier;
        private boolean isTerminal;

        public FlowNode() {}

        public FlowNode(String id, String label, double riskScore, String role,
                        double amountReceived, double amountForwarded, double amountRetained,
                        int hop, boolean isOrigin, boolean isFrontier, boolean isTerminal) {
            this.id = id;
            this.label = label;
            this.riskScore = riskScore;
            this.role = role;
            this.amountReceived = amountReceived;
            this.amountForwarded = amountForwarded;
            this.amountRetained = amountRetained;
            this.hop = hop;
            this.isOrigin = isOrigin;
            this.isFrontier = isFrontier;
            this.isTerminal = isTerminal;
        }

        // Getters and Setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public double getRiskScore() { return riskScore; }
        public void setRiskScore(double riskScore) { this.riskScore = riskScore; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public double getAmountReceived() { return amountReceived; }
        public void setAmountReceived(double amountReceived) { this.amountReceived = amountReceived; }

        public double getAmountForwarded() { return amountForwarded; }
        public void setAmountForwarded(double amountForwarded) { this.amountForwarded = amountForwarded; }

        public double getAmountRetained() { return amountRetained; }
        public void setAmountRetained(double amountRetained) { this.amountRetained = amountRetained; }

        public int getHop() { return hop; }
        public void setHop(int hop) { this.hop = hop; }

        public boolean isOrigin() { return isOrigin; }
        public void setOrigin(boolean origin) { isOrigin = origin; }

        public boolean isFrontier() { return isFrontier; }
        public void setFrontier(boolean frontier) { isFrontier = frontier; }

        public boolean isTerminal() { return isTerminal; }
        public void setTerminal(boolean terminal) { isTerminal = terminal; }
    }

    public static class FlowEdge {
        private String id;
        private String source;
        private String target;
        private double amount;
        private String timestamp;
        private int hop;
        private double percentOfSource;
        private boolean isHighRisk;

        public FlowEdge() {}

        public FlowEdge(String id, String source, String target, double amount,
                        String timestamp, int hop, double percentOfSource, boolean isHighRisk) {
            this.id = id;
            this.source = source;
            this.target = target;
            this.amount = amount;
            this.timestamp = timestamp;
            this.hop = hop;
            this.percentOfSource = percentOfSource;
            this.isHighRisk = isHighRisk;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }

        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }

        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }

        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

        public int getHop() { return hop; }
        public void setHop(int hop) { this.hop = hop; }

        public double getPercentOfSource() { return percentOfSource; }
        public void setPercentOfSource(double percentOfSource) { this.percentOfSource = percentOfSource; }

        public boolean isHighRisk() { return isHighRisk; }
        public void setHighRisk(boolean highRisk) { isHighRisk = highRisk; }
    }

    public static class FlowTimelineEvent {
        private String timestamp;
        private String fromAccount;
        private String toAccount;
        private double amount;
        private int hop;
        private String note;

        public FlowTimelineEvent() {}

        public FlowTimelineEvent(String timestamp, String fromAccount, String toAccount, double amount, int hop, String note) {
            this.timestamp = timestamp;
            this.fromAccount = fromAccount;
            this.toAccount = toAccount;
            this.amount = amount;
            this.hop = hop;
            this.note = note;
        }

        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

        public String getFromAccount() { return fromAccount; }
        public void setFromAccount(String fromAccount) { this.fromAccount = fromAccount; }

        public String getToAccount() { return toAccount; }
        public void setToAccount(String toAccount) { this.toAccount = toAccount; }

        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }

        public int getHop() { return hop; }
        public void setHop(int hop) { this.hop = hop; }

        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    public static class FlowSummary {
        private String originAccount;
        private double originalAmount;
        private double traceableAmount;
        private int hopsExplored;
        private int totalNodesCount;
        private int frontierAccountsCount;
        private double totalRetained;

        public FlowSummary() {}

        public String getOriginAccount() { return originAccount; }
        public void setOriginAccount(String originAccount) { this.originAccount = originAccount; }

        public double getOriginalAmount() { return originalAmount; }
        public void setOriginalAmount(double originalAmount) { this.originalAmount = originalAmount; }

        public double getTraceableAmount() { return traceableAmount; }
        public void setTraceableAmount(double traceableAmount) { this.traceableAmount = traceableAmount; }

        public int getHopsExplored() { return hopsExplored; }
        public void setHopsExplored(int hopsExplored) { this.hopsExplored = hopsExplored; }

        public int getTotalNodesCount() { return totalNodesCount; }
        public void setTotalNodesCount(int totalNodesCount) { this.totalNodesCount = totalNodesCount; }

        public int getFrontierAccountsCount() { return frontierAccountsCount; }
        public void setFrontierAccountsCount(int frontierAccountsCount) { this.frontierAccountsCount = frontierAccountsCount; }

        public double getTotalRetained() { return totalRetained; }
        public void setTotalRetained(double totalRetained) { this.totalRetained = totalRetained; }
    }

    public static class MoneyFlowResponse {
        private FlowSummary summary;
        private List<FlowNode> nodes;
        private List<FlowEdge> edges;
        private List<FlowTimelineEvent> timeline;

        public MoneyFlowResponse() {}

        public MoneyFlowResponse(FlowSummary summary, List<FlowNode> nodes, List<FlowEdge> edges, List<FlowTimelineEvent> timeline) {
            this.summary = summary;
            this.nodes = nodes;
            this.edges = edges;
            this.timeline = timeline;
        }

        public FlowSummary getSummary() { return summary; }
        public void setSummary(FlowSummary summary) { this.summary = summary; }

        public List<FlowNode> getNodes() { return nodes; }
        public void setNodes(List<FlowNode> nodes) { this.nodes = nodes; }

        public List<FlowEdge> getEdges() { return edges; }
        public void setEdges(List<FlowEdge> edges) { this.edges = edges; }

        public List<FlowTimelineEvent> getTimeline() { return timeline; }
        public void setTimeline(List<FlowTimelineEvent> timeline) { this.timeline = timeline; }
    }
}
