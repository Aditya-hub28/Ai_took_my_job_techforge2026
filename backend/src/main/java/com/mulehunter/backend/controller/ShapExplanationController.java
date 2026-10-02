package com.MuleTrace.backend.controller;

import java.time.Instant;
import java.util.List;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.MuleTrace.backend.repository.ShapExplanationRepository;
import com.MuleTrace.backend.DTO.ShapExplanationDTO;
import com.MuleTrace.backend.model.ShapExplanation;

import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/backend/api/visual/shap-explanations")
public class ShapExplanationController {

    private final ShapExplanationRepository repository;

    public ShapExplanationController(ShapExplanationRepository repository) {
        this.repository = repository;
    }

    @PostMapping("/batch")
    public Mono<String> saveBatch(@RequestBody List<ShapExplanationDTO> payload) {
        System.out.println("📥 SHAP payload = " + payload);

        return Flux.fromIterable(payload)
                .flatMap(dto -> repository.findByNodeId(dto.getNodeId())
                        .defaultIfEmpty(new ShapExplanation())
                        .flatMap(existing -> {

                            existing.setNodeId(dto.getNodeId());

                            existing.setAnomalyScore(dto.getAnomalyScore());

                            existing.setTopFactors(dto.getTopFactors());
                            existing.setModel(dto.getModel());
                            existing.setSource(dto.getSource());
                            existing.setUpdatedAt(Instant.now());

                            return repository.save(existing);
                        }))
                .then(Mono.just("SHAP explanations stored successfully"));
    }
}
