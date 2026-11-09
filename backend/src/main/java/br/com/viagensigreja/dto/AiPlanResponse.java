package br.com.viagensigreja.dto;

import br.com.viagensigreja.ai.AiPlanResult;
import br.com.viagensigreja.model.AiPlanStatus;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.Map;

public record AiPlanResponse(
        String id,
        String tripId,
        AiPlanStatus status,
        String focus,
        String provider,
        String model,
        String providerRequestId,
        String promptVersion,
        String snapshotHash,
        boolean currentSnapshot,
        AiPlanResult result,
        Map<String, String> travelerLabels,
        Map<String, String> busLabels,
        Map<String, String> hotelLabels,
        Map<String, String> roomLabels,
        Long inputTokens,
        Long outputTokens,
        BigDecimal estimatedCost,
        String errorCode,
        Instant createdAt,
        Instant updatedAt,
        Instant appliedAt
) {
}
