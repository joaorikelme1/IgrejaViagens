package br.com.viagensigreja.dto;

public record AiPlanningStatusResponse(
        boolean available,
        String provider,
        String model,
        long generationCooldownSeconds,
        int maxRequestsPerAdminPerHour,
        int maxRequestsPerTripPerDay
) {
}
