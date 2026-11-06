package br.com.viagensigreja.dto;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;

import java.time.Instant;
import java.util.Set;

public record TripTravelerPreferenceResponse(
        String userCpf,
        MobilityRequirement mobilityRequirement,
        SeatRegion seatRegion,
        Integer preferredBusFloor,
        String preferredRoomType,
        boolean includeInAiPlanning,
        Set<String> companionCpfs,
        Set<String> separatedFromCpfs,
        Long version,
        Instant updatedAt
) {
}
