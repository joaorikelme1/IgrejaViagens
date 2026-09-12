package br.com.viagensigreja.mapper;

import br.com.viagensigreja.dto.TravelerRoomResponseDTO;
import br.com.viagensigreja.dto.TravelerTripResponseDTO;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

@Component
public class TravelerResourceMapper {

    private final ObjectMapper objectMapper;
    private final ResourceAuthorizationService authorization;

    public TravelerResourceMapper(
            ObjectMapper objectMapper,
            ResourceAuthorizationService authorization
    ) {
        this.objectMapper = objectMapper;
        this.authorization = authorization;
    }

    public TravelerTripResponseDTO toTripResponse(Trip trip, String authenticatedCpf) {
        return new TravelerTripResponseDTO(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                trip.getDeparturePlace(),
                trip.getDepartureTime(),
                trip.getDate(),
                trip.getMaxPeople(),
                trip.getPrice(),
                trip.getArrecadationGoal(),
                trip.getRules(),
                trip.getBusesJson(),
                trip.getHotelsJson(),
                writeOwnTravelerList(authenticatedCpf)
        );
    }

    public TravelerRoomResponseDTO toRoomResponse(Room room, String authenticatedCpf) {
        List<String> safeOccupants = new ArrayList<>();
        if (room.getOccupants() != null) {
            for (String occupant : room.getOccupants()) {
                String normalized = authorization.normalizeCpf(occupant);
                if (normalized.equals(authenticatedCpf)) {
                    safeOccupants.add(authenticatedCpf);
                } else if (normalized.length() >= 4) {
                    safeOccupants.add(normalized.substring(normalized.length() - 4));
                }
            }
        }

        return new TravelerRoomResponseDTO(
                room.getId(),
                room.getType(),
                room.getCapacity(),
                room.getName(),
                room.getHotelId(),
                List.copyOf(safeOccupants),
                room.getTripId()
        );
    }

    private String writeOwnTravelerList(String cpf) {
        try {
            return objectMapper.writeValueAsString(List.of(cpf));
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel montar a resposta da viagem.", exception);
        }
    }
}
