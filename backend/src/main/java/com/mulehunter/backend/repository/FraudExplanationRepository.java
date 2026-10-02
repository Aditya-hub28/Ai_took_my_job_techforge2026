package com.MuleTrace.backend.repository;

import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import reactor.core.publisher.Mono;
import com.MuleTrace.backend.model.FraudExplanation;

public interface FraudExplanationRepository extends ReactiveMongoRepository<FraudExplanation, String>{
    Mono<FraudExplanation> findByNodeId(Long nodeId);
}