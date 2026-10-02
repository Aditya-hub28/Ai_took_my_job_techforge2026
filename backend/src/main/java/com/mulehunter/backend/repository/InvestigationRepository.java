package com.MuleTrace.backend.repository;

import com.MuleTrace.backend.model.InvestigationRecord;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface InvestigationRepository extends ReactiveMongoRepository<InvestigationRecord, String> {
    Flux<InvestigationRecord> findByTargetAccountOrderByCreatedAtDesc(String targetAccount);
    Mono<InvestigationRecord> findFirstByTargetAccountOrderByCreatedAtDesc(String targetAccount);
}
