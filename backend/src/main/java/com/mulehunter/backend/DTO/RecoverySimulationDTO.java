package com.MuleTrace.backend.DTO;

import java.util.List;

public class RecoverySimulationDTO {

    public static class SimulationRequest {
        private String originAccount;
        private List<String> selectedAccountIds;
        private Double customAmount;

        public SimulationRequest() {}

        public SimulationRequest(String originAccount, List<String> selectedAccountIds, Double customAmount) {
            this.originAccount = originAccount;
            this.selectedAccountIds = selectedAccountIds;
            this.customAmount = customAmount;
        }

        public String getOriginAccount() { return originAccount; }
        public void setOriginAccount(String originAccount) { this.originAccount = originAccount; }

        public List<String> getSelectedAccountIds() { return selectedAccountIds; }
        public void setSelectedAccountIds(List<String> selectedAccountIds) { this.selectedAccountIds = selectedAccountIds; }

        public Double getCustomAmount() { return customAmount; }
        public void setCustomAmount(Double customAmount) { this.customAmount = customAmount; }
    }

    public static class SimulationResponse {
        private String originAccount;
        private double originalAmount;
        private double traceableAmount;
        private double potentiallyProtectedAmount;
        private double estimatedRemainingExposure;
        private double protectionRate;
        private int selectedAccountsCount;
        private List<String> selectedAccounts;
        private List<String> affectedAccounts;
        private int blockedEdgesCount;
        private String simulationTimestamp;
        private String disclaimer;

        public SimulationResponse() {}

        public SimulationResponse(String originAccount, double originalAmount, double traceableAmount,
                                  double potentiallyProtectedAmount, double estimatedRemainingExposure,
                                  double protectionRate, int selectedAccountsCount,
                                  List<String> selectedAccounts, List<String> affectedAccounts,
                                  int blockedEdgesCount, String simulationTimestamp, String disclaimer) {
            this.originAccount = originAccount;
            this.originalAmount = originalAmount;
            this.traceableAmount = traceableAmount;
            this.potentiallyProtectedAmount = potentiallyProtectedAmount;
            this.estimatedRemainingExposure = estimatedRemainingExposure;
            this.protectionRate = protectionRate;
            this.selectedAccountsCount = selectedAccountsCount;
            this.selectedAccounts = selectedAccounts;
            this.affectedAccounts = affectedAccounts;
            this.blockedEdgesCount = blockedEdgesCount;
            this.simulationTimestamp = simulationTimestamp;
            this.disclaimer = disclaimer;
        }

        public String getOriginAccount() { return originAccount; }
        public void setOriginAccount(String originAccount) { this.originAccount = originAccount; }

        public double getOriginalAmount() { return originalAmount; }
        public void setOriginalAmount(double originalAmount) { this.originalAmount = originalAmount; }

        public double getTraceableAmount() { return traceableAmount; }
        public void setTraceableAmount(double traceableAmount) { this.traceableAmount = traceableAmount; }

        public double getPotentiallyProtectedAmount() { return potentiallyProtectedAmount; }
        public void setPotentiallyProtectedAmount(double potentiallyProtectedAmount) { this.potentiallyProtectedAmount = potentiallyProtectedAmount; }

        public double getEstimatedRemainingExposure() { return estimatedRemainingExposure; }
        public void setEstimatedRemainingExposure(double estimatedRemainingExposure) { this.estimatedRemainingExposure = estimatedRemainingExposure; }

        public double getProtectionRate() { return protectionRate; }
        public void setProtectionRate(double protectionRate) { this.protectionRate = protectionRate; }

        public int getSelectedAccountsCount() { return selectedAccountsCount; }
        public void setSelectedAccountsCount(int selectedAccountsCount) { this.selectedAccountsCount = selectedAccountsCount; }

        public List<String> getSelectedAccounts() { return selectedAccounts; }
        public void setSelectedAccounts(List<String> selectedAccounts) { this.selectedAccounts = selectedAccounts; }

        public List<String> getAffectedAccounts() { return affectedAccounts; }
        public void setAffectedAccounts(List<String> affectedAccounts) { this.affectedAccounts = affectedAccounts; }

        public int getBlockedEdgesCount() { return blockedEdgesCount; }
        public void setBlockedEdgesCount(int blockedEdgesCount) { this.blockedEdgesCount = blockedEdgesCount; }

        public String getSimulationTimestamp() { return simulationTimestamp; }
        public void setSimulationTimestamp(String simulationTimestamp) { this.simulationTimestamp = simulationTimestamp; }

        public String getDisclaimer() { return disclaimer; }
        public void setDisclaimer(String disclaimer) { this.disclaimer = disclaimer; }
    }
}
