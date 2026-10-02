package com.MuleTrace.backend;

import com.MuleTrace.backend.DTO.InvestigationDTO;
import com.MuleTrace.backend.model.InvestigationRecord;
import com.MuleTrace.backend.service.AgentOrchestratorService;
import com.MuleTrace.backend.service.InvestigationToolRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class AgentInvestigationSuiteTest {

    @Autowired
    private InvestigationToolRegistry toolRegistry;

    @Autowired
    private AgentOrchestratorService orchestratorService;

    @Test
    @DisplayName("Test 1: Normal or Baseline Account Profile")
    void testNormalAccountProfile() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.getAccountProfile("9999999").block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("get_account_profile", result.getTool());
        assertNotNull(result.getData().get("accountId"));
    }

    @Test
    @DisplayName("Test 2 & 3: High Velocity & Pass-Through Behavior Forensics")
    void testAnalyzeBehavior() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.analyzeBehavior("10004").block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertTrue(result.getData().containsKey("passThroughRatio"));
        assertTrue(result.getData().containsKey("isHighVelocity"));
    }

    @Test
    @DisplayName("Test 4 & 5: Network Expansion & Bounded Hops")
    void testNetworkExpansion() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.expandNetwork("10004", 2).block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals(2, ((Number) result.getData().get("maxHopsApplied")).intValue());
        assertTrue(result.getData().containsKey("hop1Counterparties"));
    }

    @Test
    @DisplayName("Test 6 & 7: Shared Device & IP Graceful 'Data unavailable' Handling")
    void testMissingDataGracefulHandling() {
        InvestigationToolRegistry.ToolResult devResult = toolRegistry.getSharedDevices("non_existent_account_123").block();
        assertNotNull(devResult);
        assertEquals("UNAVAILABLE", devResult.getStatus());
        assertTrue(devResult.getSummary().contains("Data unavailable"));

        InvestigationToolRegistry.ToolResult ipResult = toolRegistry.getSharedIps("non_existent_account_123").block();
        assertNotNull(ipResult);
        assertEquals("UNAVAILABLE", ipResult.getStatus());
        assertTrue(ipResult.getSummary().contains("Data unavailable"));
    }

    @Test
    @DisplayName("Test 8: Ring Detection & Cyclical Patterns")
    void testDetectRings() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.detectRings("10004").block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertNotNull(result.getSummary());
    }

    @Test
    @DisplayName("Test 9: Temporal Turnaround Patterns")
    void testTemporalPatterns() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.analyzeTemporalPatterns("10004").block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
    }

    @Test
    @DisplayName("Test 10: Downstream Money Flow Integration")
    void testTraceMoneyIntegration() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.traceMoney("10004", 50000.0).block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertTrue(result.getData().containsKey("totalTraceableAmount"));
    }

    @Test
    @DisplayName("Test 11: Freeze Frontier Integration")
    void testFreezeFrontierIntegration() {
        InvestigationToolRegistry.ToolResult result = toolRegistry.getFreezeFrontier("10004", 50000.0).block();
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertTrue(result.getData().containsKey("potentiallyProtectedAmount"));
    }

    @Test
    @DisplayName("Test 12: Full Orchestrated Agent Pipeline")
    void testFullInvestigationPipeline() {
        InvestigationDTO.StartInvestigationRequest req = new InvestigationDTO.StartInvestigationRequest("10004", 50000.0, 2);
        InvestigationRecord record = orchestratorService.startInvestigation(req).block();
        assertNotNull(record);
        assertNotNull(record.getId());
        assertEquals("UNDER_REVIEW", record.getStatus());
        assertFalse(record.getSteps().isEmpty());
        assertNotNull(record.getSummary());
        assertTrue(record.getSummary().getConfidence() > 0);
    }

    @Test
    @DisplayName("Test 13: Natural Language Intent Grounded Querying")
    void testNaturalLanguageQuery() {
        InvestigationDTO.InvestigationQueryRequest queryReq = new InvestigationDTO.InvestigationQueryRequest(
                null, "10004", "Why is this account suspicious?"
        );
        InvestigationDTO.InvestigationQueryResponse resp = orchestratorService.handleQuery(queryReq).block();
        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertEquals("EXPLAIN_SUSPICION", resp.getMatchedIntent());
        assertNotNull(resp.getAnswer());
        assertFalse(resp.getEvidenceCited().isEmpty());
    }
}
