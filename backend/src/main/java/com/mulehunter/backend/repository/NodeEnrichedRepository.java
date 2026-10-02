package com.MuleTrace.backend.repository;

import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;

import com.MuleTrace.backend.model.NodeEnriched;

import reactor.core.publisher.Mono;

@Repository
public interface NodeEnrichedRepository
    extends ReactiveMongoRepository<NodeEnriched, String> {

  Mono<NodeEnriched> findByNodeId(Long nodeId);
}
