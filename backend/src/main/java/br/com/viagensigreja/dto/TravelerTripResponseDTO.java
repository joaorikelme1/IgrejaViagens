package br.com.viagensigreja.dto;

import java.time.LocalDate;

public record TravelerTripResponseDTO(
        String id,
        String name,
        String destination,
        String departurePlace,
        String departureTime,
        LocalDate date,
        Integer maxPeople,
        Double price,
        Double arrecadationGoal,
        String rules,
        String busesJson,
        String hotelsJson,
        String travelersJson
) {
}
