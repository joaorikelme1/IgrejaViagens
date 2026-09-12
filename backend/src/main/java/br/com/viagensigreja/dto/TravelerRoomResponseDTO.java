package br.com.viagensigreja.dto;

import java.util.List;

public record TravelerRoomResponseDTO(
        String id,
        String type,
        int capacity,
        String name,
        String hotelId,
        List<String> occupants,
        String tripId
) {
}
