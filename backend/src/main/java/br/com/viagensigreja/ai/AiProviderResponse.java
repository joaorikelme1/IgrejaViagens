package br.com.viagensigreja.ai;

public record AiProviderResponse(
        AiPlanResult result,
        String model,
        Long inputTokens,
        Long outputTokens
) {
}
