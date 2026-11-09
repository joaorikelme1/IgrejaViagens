package br.com.viagensigreja.ai;

import java.util.List;

public record AiPlanResult(
        String summary,
        List<RoomCreation> roomCreations,
        List<RoomAssignment> roomAssignments,
        List<SeatAssignment> seatAssignments,
        List<String> warnings
) {
    public record RoomCreation(
            String key,
            String hotel,
            String name,
            String type,
            int capacity,
            String reason
    ) {
    }

    public record RoomAssignment(
            String traveler,
            String room,
            String reason
    ) {
    }

    public record SeatAssignment(
            String traveler,
            String bus,
            int floor,
            int seatNumber,
            String reason
    ) {
    }
}
