package com.MuleTrace.backend.repository;

import com.MuleTrace.backend.model.Nodes;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import reactor.core.publisher.Mono;

public interface NodesRepository extends ReactiveMongoRepository<Nodes, String> {

    Mono<Nodes> findByNodeId(Long nodeId);
}