package br.com.viagensigreja.dto;

import br.com.viagensigreja.ai.AiPlanningFocus;

public record AiPlanGenerationRequest(
        String tripId,
        AiPlanningFocus focus
) {
}
