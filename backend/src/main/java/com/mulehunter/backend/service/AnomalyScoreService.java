package com.MuleTrace.backend.service;

import java.time.Instant;

import org.springframework.stereotype.Service;

import com.MuleTrace.backend.DTO.AnomalyScoreDTO;
import com.MuleTrace.backend.model.AnomalyScore;
import com.MuleTrace.backend.repository.AnomalyScoreRepository;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class AnomalyScoreService {

    private final AnomalyScoreRepository repository;

    public AnomalyScoreService(AnomalyScoreRepository repository) {
        this.repository = repository;
    }

    public Mono<Void> saveBatch(Flux<AnomalyScoreDTO> dtos) {

        return dtos.flatMap(dto -> repository.findByNodeId(dto.getNodeId())
                .defaultIfEmpty(new AnomalyScore())
                .flatMap(existing -> {
                    existing.setNodeId(dto.getNodeId());
                    existing.setAnomalyScore(dto.getAnomalyScore());
                    existing.setIsAnomalous(dto.getIsAnomalous());
                    existing.setModel(dto.getModel());
                    existing.setSource(dto.getSource());
                    existing.setUpdatedAt(Instant.now());
                    return repository.save(existing);
                })).then();
    }
}
