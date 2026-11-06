package br.com.viagensigreja.dto;

public record AiUsageResponse(
        String tripId,
        long requestsToday,
        int maxRequestsPerDay,
        long activeGenerations
) {
}
