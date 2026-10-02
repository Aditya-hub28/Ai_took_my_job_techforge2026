package com.mulehunter.backend.DTO;

import java.util.List;

public record GraphNodeDTO(
    String nodeId,
    double anomalyScore,
    boolean isAnomalous,
    long volume,
    double pagerank,
    List<Integer> ringIds,
    Integer clusterId,
    String role,
    double ringVolume,
    double totalIncoming,
    double totalOutgoing
) {}

