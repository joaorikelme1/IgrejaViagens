package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class AiPlanValidator {

    private static final Pattern NEW_ROOM_KEY = Pattern.compile("new_room_[0-9]{3}");

    private final PlanningDataSanitizer sanitizer;

    public AiPlanValidator(PlanningDataSanitizer sanitizer) {
        this.sanitizer = sanitizer;
    }

    public AiPlanResult validate(
            TripPlanningSnapshot snapshot,
            AiPlanningFocus focus,
            AiPlanResult candidate
    ) {
        if (candidate == null) {
            throw invalid("EMPTY_PLAN", "O plano retornado esta vazio.");
        }

        List<AiPlanResult.RoomCreation> creations = list(candidate.roomCreations());
        List<AiPlanResult.RoomAssignment> roomAssignments = list(candidate.roomAssignments());
        List<AiPlanResult.SeatAssignment> seatAssignments = list(candidate.seatAssignments());
        List<String> warnings = list(candidate.warnings());
        if (creations.size() > 100 || warnings.size() > 100
                || roomAssignments.size() > 1_000 || seatAssignments.size() > 1_000) {
            throw invalid("PLAN_TOO_LARGE", "O plano retornado excede os limites permitidos.");
        }
        if (focus == AiPlanningFocus.ROOMS && !seatAssignments.isEmpty()) {
            throw invalid("FOCUS_MISMATCH", "O plano de hospedagem alterou assentos.");
        }
        if (focus == AiPlanningFocus.SEATS
                && (!creations.isEmpty() || !roomAssignments.isEmpty())) {
            throw invalid("FOCUS_MISMATCH", "O plano de transporte alterou quartos.");
        }

        Set<String> eligibleTravelers = new HashSet<>();
        snapshot.travelers().stream()
                .filter(TripPlanningSnapshot.Traveler::tripMember)
                .map(TripPlanningSnapshot.Traveler::alias)
                .forEach(eligibleTravelers::add);
        snapshot.preferences().stream()
                .filter(preference -> !preference.includedInAiPlanning())
                .map(TripPlanningSnapshot.Preference::traveler)
                .forEach(eligibleTravelers::remove);

        Map<String, Integer> roomCapacity = new LinkedHashMap<>();
        Map<String, Set<String>> occupantsByRoom = new LinkedHashMap<>();
        Set<String> alreadyInRoom = new HashSet<>();
        snapshot.rooms().forEach(room -> {
            roomCapacity.put(room.alias(), room.capacity());
            Set<String> occupants = new LinkedHashSet<>(room.occupants());
            occupantsByRoom.put(room.alias(), occupants);
            alreadyInRoom.addAll(occupants);
        });

        Set<String> hotels = new HashSet<>();
        snapshot.hotels().forEach(hotel -> hotels.add(hotel.alias()));
        List<AiPlanResult.RoomCreation> normalizedCreations = new ArrayList<>();
        Set<String> creationKeys = new HashSet<>();
        for (AiPlanResult.RoomCreation creation : creations) {
            if (creation == null || !NEW_ROOM_KEY.matcher(text(creation.key())).matches()
                    || !creationKeys.add(creation.key())) {
                throw invalid("INVALID_ROOM_CREATION", "O plano criou um quarto com chave invalida.");
            }
            if (!hotels.contains(creation.hotel())) {
                throw invalid("UNKNOWN_HOTEL", "O plano referencia um hotel inexistente.");
            }
            if (creation.capacity() < 1 || creation.capacity() > 50) {
                throw invalid("INVALID_ROOM_CAPACITY", "A capacidade de um quarto e invalida.");
            }
            String name = requiredSanitized(creation.name(), 120, "nome do quarto");
            String type = requiredSanitized(creation.type(), 80, "tipo do quarto");
            AiPlanResult.RoomCreation normalized = new AiPlanResult.RoomCreation(
                    creation.key(),
                    creation.hotel(),
                    name,
                    type,
                    creation.capacity(),
                    sanitized(creation.reason(), 300)
            );
            normalizedCreations.add(normalized);
            roomCapacity.put(creation.key(), creation.capacity());
            occupantsByRoom.put(creation.key(), new LinkedHashSet<>());
        }

        List<AiPlanResult.RoomAssignment> normalizedRoomAssignments = new ArrayList<>();
        Set<String> plannedRoomTravelers = new HashSet<>();
        for (AiPlanResult.RoomAssignment assignment : roomAssignments) {
            if (assignment == null || !eligibleTravelers.contains(assignment.traveler())) {
                throw invalid("INELIGIBLE_TRAVELER", "O plano referencia um viajante nao elegivel.");
            }
            if (alreadyInRoom.contains(assignment.traveler())
                    || !plannedRoomTravelers.add(assignment.traveler())) {
                throw invalid("DUPLICATE_ROOM_TRAVELER", "Um viajante foi atribuido a mais de um quarto.");
            }
            Set<String> occupants = occupantsByRoom.get(assignment.room());
            Integer capacity = roomCapacity.get(assignment.room());
            if (occupants == null || capacity == null) {
                throw invalid("UNKNOWN_ROOM", "O plano referencia um quarto inexistente.");
            }
            occupants.add(assignment.traveler());
            if (occupants.size() > capacity) {
                throw invalid("ROOM_CAPACITY_EXCEEDED", "O plano excede a capacidade de um quarto.");
            }
            normalizedRoomAssignments.add(new AiPlanResult.RoomAssignment(
                    assignment.traveler(),
                    assignment.room(),
                    sanitized(assignment.reason(), 300)
            ));
        }
        validateSeparations(snapshot, occupantsByRoom);

        Map<String, TripPlanningSnapshot.Bus> buses = new HashMap<>();
        snapshot.buses().forEach(bus -> buses.put(bus.alias(), bus));
        Set<String> occupiedCoordinates = new HashSet<>();
        Set<String> alreadySeated = new HashSet<>();
        snapshot.seats().forEach(seat -> {
            occupiedCoordinates.add(coordinate(seat.bus(), seat.floor(), seat.seatNumber()));
            alreadySeated.add(seat.traveler());
        });
        Map<String, TripPlanningSnapshot.Preference> preferences = new HashMap<>();
        snapshot.preferences().forEach(preference -> preferences.put(preference.traveler(), preference));

        List<AiPlanResult.SeatAssignment> normalizedSeatAssignments = new ArrayList<>();
        Set<String> plannedSeatTravelers = new HashSet<>();
        for (AiPlanResult.SeatAssignment assignment : seatAssignments) {
            if (assignment == null || !eligibleTravelers.contains(assignment.traveler())) {
                throw invalid("INELIGIBLE_TRAVELER", "O plano referencia um viajante nao elegivel.");
            }
            if (alreadySeated.contains(assignment.traveler())
                    || !plannedSeatTravelers.add(assignment.traveler())) {
                throw invalid("DUPLICATE_SEAT_TRAVELER", "Um viajante foi atribuido a mais de um assento.");
            }
            TripPlanningSnapshot.Bus bus = buses.get(assignment.bus());
            if (bus == null || !validSeat(bus, assignment.floor(), assignment.seatNumber())) {
                throw invalid("INVALID_SEAT", "O plano referencia um assento inexistente.");
            }
            if (!occupiedCoordinates.add(coordinate(
                    assignment.bus(),
                    assignment.floor(),
                    assignment.seatNumber()
            ))) {
                throw invalid("SEAT_ALREADY_OCCUPIED", "O plano usa um assento ja ocupado.");
            }
            TripPlanningSnapshot.Preference preference = preferences.get(assignment.traveler());
            if (preference != null
                    && preference.includedInAiPlanning()
                    && preference.mobilityRequirement() == MobilityRequirement.REQUIRE_LOWER_FLOOR
                    && assignment.floor() != 1) {
                throw invalid("MOBILITY_CONFLICT", "O plano viola um requisito obrigatorio de mobilidade.");
            }
            normalizedSeatAssignments.add(new AiPlanResult.SeatAssignment(
                    assignment.traveler(),
                    assignment.bus(),
                    assignment.floor(),
                    assignment.seatNumber(),
                    sanitized(assignment.reason(), 300)
            ));
        }

        return new AiPlanResult(
                requiredSanitized(candidate.summary(), 600, "resumo"),
                List.copyOf(normalizedCreations),
                List.copyOf(normalizedRoomAssignments),
                List.copyOf(normalizedSeatAssignments),
                warnings.stream()
                        .map(value -> sanitized(value, 400))
                        .filter(value -> !value.isBlank())
                        .distinct()
                        .toList()
        );
    }

    private void validateSeparations(
            TripPlanningSnapshot snapshot,
            Map<String, Set<String>> occupantsByRoom
    ) {
        Map<String, String> roomByTraveler = new HashMap<>();
        occupantsByRoom.forEach((room, occupants) ->
                occupants.forEach(traveler -> roomByTraveler.put(traveler, room))
        );
        for (TripPlanningSnapshot.Preference preference : snapshot.preferences()) {
            if (!preference.includedInAiPlanning()) {
                continue;
            }
            String room = roomByTraveler.get(preference.traveler());
            if (room == null) {
                continue;
            }
            for (String separated : preference.separatedFrom()) {
                if (room.equals(roomByTraveler.get(separated))) {
                    throw invalid("SEPARATION_CONFLICT", "O plano viola uma restricao de separacao.");
                }
            }
        }
    }

    private boolean validSeat(TripPlanningSnapshot.Bus bus, int floor, int seatNumber) {
        if (floor < 1 || floor > bus.floors() || seatNumber < 1) {
            return false;
        }
        int capacity = floor == 1 ? bus.seatsFloor1() : bus.seatsFloor2();
        if (capacity <= 0 && bus.floors() == 1 && floor == 1) {
            capacity = bus.seats();
        }
        return seatNumber <= capacity;
    }

    private String coordinate(String bus, int floor, int seatNumber) {
        return bus + "\n" + floor + "\n" + seatNumber;
    }

    private String requiredSanitized(String value, int maximumLength, String label) {
        String result = sanitized(value, maximumLength);
        if (result.isBlank()) {
            throw invalid("INVALID_TEXT", "O " + label + " do plano e invalido.");
        }
        return result;
    }

    private String sanitized(String value, int maximumLength) {
        return sanitizer.sanitize(value, maximumLength);
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }

    private <T> List<T> list(List<T> values) {
        return values == null ? List.of() : values;
    }

    private AiPlanValidationException invalid(String code, String message) {
        return new AiPlanValidationException(code, message);
    }
}
