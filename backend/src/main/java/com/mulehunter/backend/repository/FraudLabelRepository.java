package com.MuleTrace.backend.repository;

import com.MuleTrace.backend.model.FraudLabel;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface FraudLabelRepository 
        extends ReactiveCrudRepository<FraudLabel, String> {

    Mono<FraudLabel> findByTransactionId(String transactionId);
}