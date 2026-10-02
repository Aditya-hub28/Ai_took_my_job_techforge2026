package com.MuleTrace.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.MuleTrace.backend.DTO.FreezeFrontierDTO;
import com.MuleTrace.backend.DTO.InvestigationDTO;
import com.MuleTrace.backend.DTO.MoneyFlowDTO;
import com.MuleTrace.backend.DTO.RecoverySimulationDTO;
import com.MuleTrace.backend.model.InvestigationRecord;
import com.MuleTrace.backend.service.AgentOrchestratorService;
import com.MuleTrace.backend.service.RecoverySimulationService;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/investigation")
@CrossOrigin(origins = "*")
public class InvestigationController {

    private final RecoverySimulationService simulationService;
    private final AgentOrchestratorService orchestratorService;

    public InvestigationController(
            RecoverySimulationService simulationService,
            AgentOrchestratorService orchestratorService) {
        this.simulationService = simulationService;
        this.orchestratorService = orchestratorService;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AGENTIC INVESTIGATION WORKFLOW APIS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/investigation/start
     * Body: { "targetAccount": "10004", "customAmount": 50000.0, "maxHops": 2 }
     */
    @PostMapping("/start")
    public Mono<ResponseEntity<InvestigationRecord>> startInvestigation(
            @RequestBody InvestigationDTO.StartInvestigationRequest request) {
        return orchestratorService.startInvestigation(request)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.badRequest().build());
    }

    /**
     * GET /api/investigation/{id}
     */
    @GetMapping("/{id}")
    public Mono<ResponseEntity<InvestigationRecord>> getInvestigation(@PathVariable String id) {
        return orchestratorService.getInvestigation(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/investigation/{id}/status
     */
    @GetMapping("/{id}/status")
    public Mono<ResponseEntity<Map<String, Object>>> getInvestigationStatus(@PathVariable String id) {
        return orchestratorService.getInvestigation(id)
                .map(inv -> {
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("id", inv.getId());
                    resp.put("status", inv.getStatus());
                    resp.put("stepsCount", inv.getSteps().size());
                    resp.put("evidenceCount", inv.getEvidence().size());
                    return ResponseEntity.ok(resp);
                })
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/investigation/{id}/evidence
     */
    @GetMapping("/{id}/evidence")
    public Mono<ResponseEntity<List<InvestigationRecord.EvidenceItem>>> getEvidence(@PathVariable String id) {
        return orchestratorService.getInvestigation(id)
                .map(inv -> ResponseEntity.ok(inv.getEvidence()))
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/investigation/{id}/timeline
     */
    @GetMapping("/{id}/timeline")
    public Mono<ResponseEntity<List<InvestigationDTO.TimelineEvent>>> getTimeline(@PathVariable String id) {
        return orchestratorService.getTimeline(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/investigation/{id}/graph
     */
    @GetMapping("/{id}/graph")
    public Mono<ResponseEntity<InvestigationDTO.InvestigationGraphResponse>> getGraph(@PathVariable String id) {
        return orchestratorService.getGraph(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/investigation/query
     * Natural Language Copilot Query
     * Body: { "investigationId": "INV-10004-xxx", "targetAccount": "10004", "query": "Why is this account suspicious?" }
     */
    @PostMapping("/query")
    public Mono<ResponseEntity<InvestigationDTO.InvestigationQueryResponse>> handleQuery(
            @RequestBody InvestigationDTO.InvestigationQueryRequest request) {
        return orchestratorService.handleQuery(request)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.badRequest().build());
    }

    /**
     * POST /api/investigation/{id}/decision
     * Human-in-the-loop decision: { "decision": "CONFIRMED", "investigatorName": "Officer Sharma", "note": "Escalated to Cyber Cell" }
     */
    @PostMapping("/{id}/decision")
    public Mono<ResponseEntity<InvestigationRecord>> recordDecision(
            @PathVariable String id,
            @RequestBody InvestigationDTO.InvestigationDecisionRequest request) {
        return orchestratorService.recordDecision(id, request)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/investigation/{id}/cancel
     */
    @PostMapping("/{id}/cancel")
    public Mono<ResponseEntity<InvestigationRecord>> cancelInvestigation(@PathVariable String id) {
        InvestigationDTO.InvestigationDecisionRequest req = new InvestigationDTO.InvestigationDecisionRequest();
        req.setDecision("CANCELLED");
        req.setInvestigatorName("Investigator");
        req.setNote("Investigation cancelled by user.");
        return orchestratorService.recordDecision(id, req)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PREVIOUS RECOVERY SIMULATION APIS (PRESERVED 100%)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/investigation/money-flow
     * Body: { "originAccount": "10004", "customAmount": 85000.0 }
     */
    @PostMapping("/money-flow")
    public Mono<ResponseEntity<MoneyFlowDTO.MoneyFlowResponse>> getMoneyFlow(
            @RequestBody Map<String, Object> body) {

        String origin = body.getOrDefault("originAccount", "10004").toString();
        Double customAmount = body.get("customAmount") != null
                ? Double.parseDouble(body.get("customAmount").toString())
                : null;

        return simulationService.getMoneyFlow(origin, customAmount)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/investigation/freeze-frontier
     * Body: { "originAccount": "10004", "customAmount": 85000.0 }
     */
    @PostMapping("/freeze-frontier")
    public Mono<ResponseEntity<FreezeFrontierDTO.FreezeFrontierResponse>> getFreezeFrontier(
            @RequestBody Map<String, Object> body) {

        String origin = body.getOrDefault("originAccount", "10004").toString();
        Double customAmount = body.get("customAmount") != null
                ? Double.parseDouble(body.get("customAmount").toString())
                : null;

        return simulationService.getFreezeFrontier(origin, customAmount)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/investigation/recovery-simulation
     * Body: { "originAccount": "10004", "selectedAccountIds": ["10023", "11839"], "customAmount": 85000.0 }
     */
    @PostMapping("/recovery-simulation")
    public Mono<ResponseEntity<RecoverySimulationDTO.SimulationResponse>> simulateRecovery(
            @RequestBody RecoverySimulationDTO.SimulationRequest request) {

        return simulationService.simulateRecovery(request)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/investigation/test-scenario
     */
    @GetMapping("/test-scenario")
    public ResponseEntity<MoneyFlowDTO.MoneyFlowResponse> getTestScenario() {
        return ResponseEntity.ok(simulationService.getSyntheticTestScenario());
    }
}
