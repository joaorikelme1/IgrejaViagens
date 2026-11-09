package br.com.viagensigreja.dto;

public record AiPlanApplicationResponse(
        String planId,
        int roomsCreated,
        int travelersAssignedToRooms,
        int travelersAssignedToSeats
) {
}
