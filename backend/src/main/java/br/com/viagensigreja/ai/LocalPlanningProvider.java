package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class LocalPlanningProvider implements AiPlanningProvider {

    static final String PROVIDER = "local";
    static final String MODEL = "planejador-deterministico-v1";

    private final AiPlanningProperties properties;

    public LocalPlanningProvider(AiPlanningProperties properties) {
        this.properties = properties;
    }

    @Override
    public String providerName() {
        return PROVIDER;
    }

    @Override
    public String configuredModel() {
        return MODEL;
    }

    @Override
    public boolean isConfigured() {
        return properties.isEnabled();
    }

    @Override
    public AiProviderResponse generate(TripPlanningSnapshot snapshot, AiPlanningFocus focus) {
        PlanningState state = state(snapshot);
        List<AiPlanResult.RoomCreation> roomCreations = new ArrayList<>();
        List<AiPlanResult.RoomAssignment> roomAssignments = new ArrayList<>();
        List<AiPlanResult.SeatAssignment> seatAssignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (focus != AiPlanningFocus.SEATS) {
            planRooms(snapshot, state, roomCreations, roomAssignments, warnings);
        }
        if (focus != AiPlanningFocus.ROOMS) {
            planSeats(snapshot, state, seatAssignments, warnings);
        }

        long excluded = snapshot.preferences().stream()
                .filter(preference -> !preference.includedInAiPlanning())
                .count();
        if (excluded > 0) {
            warnings.add(excluded + " viajante(s) foram mantidos fora do planejamento automático.");
        }
        String summary = "Planejamento automático calculado: "
                + roomCreations.size() + " quarto(s) novo(s), "
                + roomAssignments.size() + " acomodação(ões) e "
                + seatAssignments.size() + " assento(s) sugerido(s).";
        return new AiProviderResponse(
                new AiPlanResult(
                        summary,
                        List.copyOf(roomCreations),
                        List.copyOf(roomAssignments),
                        List.copyOf(seatAssignments),
                        warnings.stream().distinct().toList()
                ),
                MODEL,
                null,
                null
        );
    }

    private PlanningState state(TripPlanningSnapshot snapshot) {
        Map<String, TripPlanningSnapshot.Preference> preferences = new LinkedHashMap<>();
        snapshot.preferences().forEach(value -> preferences.put(value.traveler(), value));

        Set<String> eligible = new LinkedHashSet<>();
        snapshot.travelers().stream()
                .filter(TripPlanningSnapshot.Traveler::tripMember)
                .map(TripPlanningSnapshot.Traveler::alias)
                .filter(traveler -> {
                    TripPlanningSnapshot.Preference preference = preferences.get(traveler);
                    return preference == null || preference.includedInAiPlanning();
                })
                .forEach(eligible::add);

        Map<String, Set<String>> related = initializeRelations(eligible);
        snapshot.familyLinks().forEach(link -> connect(
                related,
                link.firstTraveler(),
                link.secondTraveler()
        ));
        snapshot.preferences().stream()
                .filter(TripPlanningSnapshot.Preference::includedInAiPlanning)
                .forEach(preference -> preference.companions().forEach(companion ->
                        connect(related, preference.traveler(), companion)
                ));

        Map<String, Set<String>> separated = new HashMap<>();
        snapshot.preferences().stream()
                .filter(TripPlanningSnapshot.Preference::includedInAiPlanning)
                .forEach(preference -> preference.separatedFrom().forEach(other -> {
                    separated.computeIfAbsent(preference.traveler(), ignored -> new HashSet<>())
                            .add(other);
                    separated.computeIfAbsent(other, ignored -> new HashSet<>())
                            .add(preference.traveler());
                }));
        return new PlanningState(
                eligible,
                preferences,
                related,
                separated,
                planningOrder(eligible, related)
        );
    }

    private void planRooms(
            TripPlanningSnapshot snapshot,
            PlanningState state,
            List<AiPlanResult.RoomCreation> creations,
            List<AiPlanResult.RoomAssignment> assignments,
            List<String> warnings
    ) {
        List<RoomState> rooms = snapshot.rooms().stream()
                .map(room -> new RoomState(
                        room.alias(),
                        room.hotel(),
                        room.type(),
                        room.capacity(),
                        new LinkedHashSet<>(room.occupants())
                ))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        Set<String> alreadyAssigned = new HashSet<>();
        rooms.forEach(room -> alreadyAssigned.addAll(room.occupants));
        int missing = 0;

        for (String traveler : state.order) {
            if (!state.eligible.contains(traveler) || alreadyAssigned.contains(traveler)) {
                continue;
            }
            if (assignments.size() >= 1_000) {
                missing++;
                continue;
            }
            RoomState room = rooms.stream()
                    .filter(candidate -> candidate.occupants.size() < candidate.capacity)
                    .filter(candidate -> candidate.occupants.stream().noneMatch(occupant -> {
                        TripPlanningSnapshot.Preference preference = state.preferences.get(occupant);
                        return preference != null && !preference.includedInAiPlanning();
                    }))
                    .filter(candidate -> canShare(traveler, candidate.occupants, state.separated))
                    .max(Comparator
                            .comparingInt((RoomState candidate) -> roomScore(
                                    traveler,
                                    candidate,
                                    state
                            ))
                            .thenComparingInt(candidate -> candidate.occupants.size())
                            .thenComparing(candidate -> candidate.alias, Comparator.reverseOrder()))
                    .orElse(null);

            if (room == null && !snapshot.hotels().isEmpty() && creations.size() < 100) {
                String key = "new_room_%03d".formatted(creations.size() + 1);
                int capacity = suggestedCapacity(traveler, alreadyAssigned, state);
                String type = preferredRoomType(traveler, state);
                String hotel = preferredHotel(traveler, rooms, state);
                if (hotel == null) {
                    hotel = snapshot.hotels().get(0).alias();
                }
                room = new RoomState(key, hotel, type, capacity, new LinkedHashSet<>());
                rooms.add(room);
                creations.add(new AiPlanResult.RoomCreation(
                        key,
                        hotel,
                        "Quarto sugerido %d".formatted(creations.size() + 1),
                        type,
                        capacity,
                        "Criado para acomodar viajantes ainda sem quarto respeitando as restrições registradas."
                ));
            }

            if (room == null) {
                missing++;
                continue;
            }
            String reason = roomReason(traveler, room, state);
            room.occupants.add(traveler);
            alreadyAssigned.add(traveler);
            assignments.add(new AiPlanResult.RoomAssignment(traveler, room.alias, reason));
        }
        if (missing > 0) {
            warnings.add(missing + " viajante(s) ficaram sem quarto por falta de hotel ou capacidade válida.");
        }
    }

    private void planSeats(
            TripPlanningSnapshot snapshot,
            PlanningState state,
            List<AiPlanResult.SeatAssignment> assignments,
            List<String> warnings
    ) {
        Map<String, TripPlanningSnapshot.Bus> buses = new LinkedHashMap<>();
        snapshot.buses().forEach(bus -> buses.put(bus.alias(), bus));
        Set<String> occupied = new HashSet<>();
        Map<String, SeatPosition> seatByTraveler = new HashMap<>();
        snapshot.seats().forEach(seat -> {
            SeatPosition position = new SeatPosition(seat.bus(), seat.floor(), seat.seatNumber());
            occupied.add(position.key());
            seatByTraveler.put(seat.traveler(), position);
        });
        List<SeatPosition> positions = new ArrayList<>();
        snapshot.buses().forEach(bus -> {
            int floors = Math.max(1, Math.min(2, bus.floors()));
            for (int floor = 1; floor <= floors; floor++) {
                int capacity = floorCapacity(bus, floor);
                for (int seatNumber = 1; seatNumber <= capacity; seatNumber++) {
                    SeatPosition position = new SeatPosition(bus.alias(), floor, seatNumber);
                    if (!occupied.contains(position.key())) {
                        positions.add(position);
                    }
                }
            }
        });

        int missing = 0;
        int mandatoryMobilityMissing = 0;
        for (String traveler : state.order) {
            if (!state.eligible.contains(traveler) || seatByTraveler.containsKey(traveler)) {
                continue;
            }
            if (assignments.size() >= 1_000) {
                missing++;
                continue;
            }
            TripPlanningSnapshot.Preference preference = state.preferences.get(traveler);
            List<SeatPosition> allowed = positions.stream()
                    .filter(position -> !occupied.contains(position.key()))
                    .filter(position -> !requiresLowerFloor(preference) || position.floor == 1)
                    .toList();
            SeatPosition selected = allowed.stream()
                    .max(Comparator
                            .comparingInt((SeatPosition position) -> seatScore(
                                    traveler,
                                    position,
                                    buses.get(position.bus),
                                    preference,
                                    state.related,
                                    seatByTraveler
                            ))
                            .thenComparing(SeatPosition::bus, Comparator.reverseOrder())
                            .thenComparing(SeatPosition::floor, Comparator.reverseOrder())
                            .thenComparing(SeatPosition::seatNumber, Comparator.reverseOrder()))
                    .orElse(null);
            if (selected == null) {
                missing++;
                if (requiresLowerFloor(preference)) {
                    mandatoryMobilityMissing++;
                }
                continue;
            }
            occupied.add(selected.key());
            seatByTraveler.put(traveler, selected);
            assignments.add(new AiPlanResult.SeatAssignment(
                    traveler,
                    selected.bus,
                    selected.floor,
                    selected.seatNumber,
                    seatReason(traveler, selected, preference, state.related, seatByTraveler)
            ));
        }
        if (mandatoryMobilityMissing > 0) {
            warnings.add(mandatoryMobilityMissing
                    + " viajante(s) com exigência de piso inferior ficaram sem assento compatível.");
        }
        if (missing - mandatoryMobilityMissing > 0) {
            warnings.add((missing - mandatoryMobilityMissing)
                    + " viajante(s) ficaram sem assento por falta de vagas válidas.");
        }
    }

    private Map<String, Set<String>> initializeRelations(Set<String> eligible) {
        Map<String, Set<String>> result = new LinkedHashMap<>();
        eligible.forEach(traveler -> result.put(traveler, new LinkedHashSet<>()));
        return result;
    }

    private void connect(Map<String, Set<String>> relations, String first, String second) {
        if (first == null || second == null || first.equals(second)
                || !relations.containsKey(first) || !relations.containsKey(second)) {
            return;
        }
        relations.get(first).add(second);
        relations.get(second).add(first);
    }

    private List<String> planningOrder(Set<String> eligible, Map<String, Set<String>> related) {
        List<String> result = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        for (String first : eligible) {
            if (!visited.add(first)) {
                continue;
            }
            ArrayDeque<String> queue = new ArrayDeque<>();
            queue.add(first);
            while (!queue.isEmpty()) {
                String current = queue.removeFirst();
                result.add(current);
                related.getOrDefault(current, Set.of()).stream()
                        .sorted()
                        .filter(visited::add)
                        .forEach(queue::addLast);
            }
        }
        return result;
    }

    private boolean canShare(
            String traveler,
            Set<String> occupants,
            Map<String, Set<String>> separated
    ) {
        return occupants.stream().noneMatch(
                occupant -> separated.getOrDefault(traveler, Set.of()).contains(occupant)
        );
    }

    private int roomScore(String traveler, RoomState room, PlanningState state) {
        int score = 0;
        Set<String> related = state.related.getOrDefault(traveler, Set.of());
        score += (int) room.occupants.stream().filter(related::contains).count() * 100;
        String preferredType = preference(traveler, state).preferredRoomType();
        if (preferredType != null && !preferredType.isBlank()
                && room.type != null && room.type.equalsIgnoreCase(preferredType.trim())) {
            score += 35;
        }
        score += Math.max(0, 10 - (room.capacity - room.occupants.size()));
        return score;
    }

    private int suggestedCapacity(
            String traveler,
            Set<String> alreadyAssigned,
            PlanningState state
    ) {
        long groupSize = java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(traveler),
                        state.related.getOrDefault(traveler, Set.of()).stream()
                )
                .filter(state.eligible::contains)
                .filter(value -> !alreadyAssigned.contains(value))
                .filter(value -> canShare(value, Set.of(traveler), state.separated))
                .distinct()
                .count();
        return (int) Math.min(50, Math.max(1, groupSize));
    }

    private String preferredRoomType(String traveler, PlanningState state) {
        return java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(traveler),
                        state.related.getOrDefault(traveler, Set.of()).stream()
                )
                .map(value -> preference(value, state).preferredRoomType())
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElseGet(() -> {
                    long size = java.util.stream.Stream.concat(
                                    java.util.stream.Stream.of(traveler),
                                    state.related.getOrDefault(traveler, Set.of()).stream()
                            )
                            .filter(state.eligible::contains)
                            .distinct()
                            .count();
                    if (size <= 1) {
                        return "Individual";
                    }
                    if (size == 2) {
                        return "Duplo";
                    }
                    if (size == 3) {
                        return "Triplo";
                    }
                    return "Familia";
                });
    }

    private String preferredHotel(String traveler, List<RoomState> rooms, PlanningState state) {
        Set<String> related = state.related.getOrDefault(traveler, Set.of());
        return rooms.stream()
                .filter(room -> room.occupants.stream().anyMatch(related::contains))
                .map(room -> room.hotel)
                .findFirst()
                .orElse(null);
    }

    private String roomReason(String traveler, RoomState room, PlanningState state) {
        if (room.occupants.stream().anyMatch(
                state.related.getOrDefault(traveler, Set.of())::contains
        )) {
            return "Mantém familiares ou acompanhantes no mesmo quarto quando há capacidade.";
        }
        String preferredType = preference(traveler, state).preferredRoomType();
        if (preferredType != null && room.type != null
                && room.type.equalsIgnoreCase(preferredType.trim())) {
            return "Atende ao tipo de quarto preferido.";
        }
        return "Utiliza uma vaga disponível sem exceder a capacidade do quarto.";
    }

    private int seatScore(
            String traveler,
            SeatPosition position,
            TripPlanningSnapshot.Bus bus,
            TripPlanningSnapshot.Preference preference,
            Map<String, Set<String>> related,
            Map<String, SeatPosition> seatByTraveler
    ) {
        int score = position.floor == 1 ? 1 : 0;
        if (preference != null) {
            if (preference.preferredBusFloor() != null
                    && preference.preferredBusFloor() == position.floor) {
                score += 45;
            }
            if (preference.mobilityRequirement() == MobilityRequirement.PREFER_LOWER_FLOOR
                    && position.floor == 1) {
                score += 35;
            }
            if (matchesRegion(preference.seatRegion(), position, bus)) {
                score += 25;
            }
        }
        for (String companion : related.getOrDefault(traveler, Set.of())) {
            SeatPosition other = seatByTraveler.get(companion);
            if (other == null || !other.bus.equals(position.bus)) {
                continue;
            }
            score += 20;
            if (other.floor == position.floor) {
                score += 35;
                if (Math.abs(other.seatNumber - position.seatNumber) == 1) {
                    score += 70;
                }
            }
        }
        return score;
    }

    private boolean matchesRegion(
            SeatRegion region,
            SeatPosition position,
            TripPlanningSnapshot.Bus bus
    ) {
        if (region == null || region == SeatRegion.ANY || bus == null) {
            return false;
        }
        int capacity = floorCapacity(bus, position.floor);
        if (capacity < 1) {
            return false;
        }
        double relative = (position.seatNumber - 0.5d) / capacity;
        return switch (region) {
            case FRONT -> relative <= 1d / 3d;
            case MIDDLE -> relative > 1d / 3d && relative <= 2d / 3d;
            case BACK -> relative > 2d / 3d;
            case ANY -> false;
        };
    }

    private String seatReason(
            String traveler,
            SeatPosition position,
            TripPlanningSnapshot.Preference preference,
            Map<String, Set<String>> related,
            Map<String, SeatPosition> seatByTraveler
    ) {
        boolean nearby = related.getOrDefault(traveler, Set.of()).stream()
                .map(seatByTraveler::get)
                .filter(value -> value != null && value.bus.equals(position.bus)
                        && value.floor == position.floor)
                .anyMatch(value -> Math.abs(value.seatNumber - position.seatNumber) <= 1);
        if (nearby) {
            return "Mantém familiares ou acompanhantes em assentos próximos.";
        }
        if (preference != null && (requiresLowerFloor(preference)
                || preference.mobilityRequirement() == MobilityRequirement.PREFER_LOWER_FLOOR)) {
            return "Prioriza o piso inferior conforme a necessidade de mobilidade.";
        }
        if (preference != null && preference.seatRegion() != null
                && preference.seatRegion() != SeatRegion.ANY) {
            return "Prioriza a região de assento registrada para o viajante.";
        }
        return "Seleciona uma vaga válida disponível no ônibus.";
    }

    private boolean requiresLowerFloor(TripPlanningSnapshot.Preference preference) {
        return preference != null
                && preference.mobilityRequirement() == MobilityRequirement.REQUIRE_LOWER_FLOOR;
    }

    private int floorCapacity(TripPlanningSnapshot.Bus bus, int floor) {
        int capacity = floor == 1 ? bus.seatsFloor1() : bus.seatsFloor2();
        if (floor == 1 && bus.floors() == 1 && capacity <= 0) {
            return Math.max(0, bus.seats());
        }
        return Math.max(0, capacity);
    }

    private TripPlanningSnapshot.Preference preference(String traveler, PlanningState state) {
        TripPlanningSnapshot.Preference value = state.preferences.get(traveler);
        return value == null
                ? new TripPlanningSnapshot.Preference(
                        traveler,
                        true,
                        MobilityRequirement.NONE,
                        SeatRegion.ANY,
                        null,
                        "",
                        List.of(),
                        List.of()
                )
                : value;
    }

    private record PlanningState(
            Set<String> eligible,
            Map<String, TripPlanningSnapshot.Preference> preferences,
            Map<String, Set<String>> related,
            Map<String, Set<String>> separated,
            List<String> order
    ) {
    }

    private static final class RoomState {
        private final String alias;
        private final String hotel;
        private final String type;
        private final int capacity;
        private final Set<String> occupants;

        private RoomState(
                String alias,
                String hotel,
                String type,
                int capacity,
                Set<String> occupants
        ) {
            this.alias = alias;
            this.hotel = hotel;
            this.type = type;
            this.capacity = capacity;
            this.occupants = occupants;
        }
    }

    private record SeatPosition(String bus, int floor, int seatNumber) {
        private String key() {
            return bus + "\n" + floor + "\n" + seatNumber;
        }
    }
}
