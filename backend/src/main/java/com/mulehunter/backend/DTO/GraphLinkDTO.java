package com.MuleTrace.backend.DTO;

import java.math.BigDecimal;

public record GraphLinkDTO(
        String source,
        String target,
        BigDecimal amount
) {}
