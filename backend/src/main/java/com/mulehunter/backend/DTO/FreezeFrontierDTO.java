package com.MuleTrace.backend.DTO;

import java.util.List;

public class FreezeFrontierDTO {

    public static class FreezeCandidate {
        private String accountId;
        private double potentialProtectedAmount;
        private double downstreamExposure;
        private double riskScore;
        private int hopDistance;
        private int connectedSuspiciousCount;
        private String recency;
        private double traceablePercentage;
        private String role;
        private List<String> reasons;

        public FreezeCandidate() {}

        public FreezeCandidate(String accountId, double potentialProtectedAmount, double downstreamExposure,
                               double riskScore, int hopDistance, int connectedSuspiciousCount,
                               String recency, double traceablePercentage, String role, List<String> reasons) {
            this.accountId = accountId;
            this.potentialProtectedAmount = potentialProtectedAmount;
            this.downstreamExposure = downstreamExposure;
            this.riskScore = riskScore;
            this.hopDistance = hopDistance;
            this.connectedSuspiciousCount = connectedSuspiciousCount;
            this.recency = recency;
            this.traceablePercentage = traceablePercentage;
            this.role = role;
            this.reasons = reasons;
        }

        public String getAccountId() { return accountId; }
        public void setAccountId(String accountId) { this.accountId = accountId; }

        public double getPotentialProtectedAmount() { return potentialProtectedAmount; }
        public void setPotentialProtectedAmount(double potentialProtectedAmount) { this.potentialProtectedAmount = potentialProtectedAmount; }

        public double getDownstreamExposure() { return downstreamExposure; }
        public void setDownstreamExposure(double downstreamExposure) { this.downstreamExposure = downstreamExposure; }

        public double getRiskScore() { return riskScore; }
        public void setRiskScore(double riskScore) { this.riskScore = riskScore; }

        public int getHopDistance() { return hopDistance; }
        public void setHopDistance(int hopDistance) { this.hopDistance = hopDistance; }

        public int getConnectedSuspiciousCount() { return connectedSuspiciousCount; }
        public void setConnectedSuspiciousCount(int connectedSuspiciousCount) { this.connectedSuspiciousCount = connectedSuspiciousCount; }

        public String getRecency() { return recency; }
        public void setRecency(String recency) { this.recency = recency; }

        public double getTraceablePercentage() { return traceablePercentage; }
        public void setTraceablePercentage(double traceablePercentage) { this.traceablePercentage = traceablePercentage; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public List<String> getReasons() { return reasons; }
        public void setReasons(List<String> reasons) { this.reasons = reasons; }
    }

    public static class StrategyOption {
        private String strategyId; // "A", "B", "C"
        private String title;
        private String description;
        private List<String> targetAccounts;
        private int accountsCount;
        private double potentialProtectedAmount;
        private double estimatedRemainingExposure;
        private double protectionRate;

        public StrategyOption() {}

        public StrategyOption(String strategyId, String title, String description, List<String> targetAccounts,
                              int accountsCount, double potentialProtectedAmount,
                              double estimatedRemainingExposure, double protectionRate) {
            this.strategyId = strategyId;
            this.title = title;
            this.description = description;
            this.targetAccounts = targetAccounts;
            this.accountsCount = accountsCount;
            this.potentialProtectedAmount = potentialProtectedAmount;
            this.estimatedRemainingExposure = estimatedRemainingExposure;
            this.protectionRate = protectionRate;
        }

        public String getStrategyId() { return strategyId; }
        public void setStrategyId(String strategyId) { this.strategyId = strategyId; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public List<String> getTargetAccounts() { return targetAccounts; }
        public void setTargetAccounts(List<String> targetAccounts) { this.targetAccounts = targetAccounts; }

        public int getAccountsCount() { return accountsCount; }
        public void setAccountsCount(int accountsCount) { this.accountsCount = accountsCount; }

        public double getPotentialProtectedAmount() { return potentialProtectedAmount; }
        public void setPotentialProtectedAmount(double potentialProtectedAmount) { this.potentialProtectedAmount = potentialProtectedAmount; }

        public double getEstimatedRemainingExposure() { return estimatedRemainingExposure; }
        public void setEstimatedRemainingExposure(double estimatedRemainingExposure) { this.estimatedRemainingExposure = estimatedRemainingExposure; }

        public double getProtectionRate() { return protectionRate; }
        public void setProtectionRate(double protectionRate) { this.protectionRate = protectionRate; }
    }

    public static class FreezeFrontierResponse {
        private String originAccount;
        private double originalAmount;
        private double traceableAmount;
        private List<FreezeCandidate> candidates;
        private List<StrategyOption> strategies;

        public FreezeFrontierResponse() {}

        public FreezeFrontierResponse(String originAccount, double originalAmount, double traceableAmount,
                                      List<FreezeCandidate> candidates, List<StrategyOption> strategies) {
            this.originAccount = originAccount;
            this.originalAmount = originalAmount;
            this.traceableAmount = traceableAmount;
            this.candidates = candidates;
            this.strategies = strategies;
        }

        public String getOriginAccount() { return originAccount; }
        public void setOriginAccount(String originAccount) { this.originAccount = originAccount; }

        public double getOriginalAmount() { return originalAmount; }
        public void setOriginalAmount(double originalAmount) { this.originalAmount = originalAmount; }

        public double getTraceableAmount() { return traceableAmount; }
        public void setTraceableAmount(double traceableAmount) { this.traceableAmount = traceableAmount; }

        public List<FreezeCandidate> getCandidates() { return candidates; }
        public void setCandidates(List<FreezeCandidate> candidates) { this.candidates = candidates; }

        public List<StrategyOption> getStrategies() { return strategies; }
        public void setStrategies(List<StrategyOption> strategies) { this.strategies = strategies; }
    }
}
