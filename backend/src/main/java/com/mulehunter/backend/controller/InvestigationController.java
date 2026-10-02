package com.MuleTrace.backend.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.MuleTrace.backend.DTO.FreezeFrontierDTO;
import com.MuleTrace.backend.DTO.MoneyFlowDTO;
import com.MuleTrace.backend.DTO.RecoverySimulationDTO;
import com.MuleTrace.backend.service.RecoverySimulationService;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/investigation")
@CrossOrigin(origins = "*")
public class InvestigationController {

    private final RecoverySimulationService simulationService;

    public InvestigationController(RecoverySimulationService simulationService) {
        this.simulationService = simulationService;
    }

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
     * Returns the Step 14 synthetic verification test scenario (V1 -> M1 -> M2/M3 -> M4).
     */
    @GetMapping("/test-scenario")
    public ResponseEntity<MoneyFlowDTO.MoneyFlowResponse> getTestScenario() {
        return ResponseEntity.ok(simulationService.getSyntheticTestScenario());
    }
}
