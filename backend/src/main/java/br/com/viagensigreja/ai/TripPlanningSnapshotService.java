package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.TripTravelerPreferenceRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Service
public class TripPlanningSnapshotService {

    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final SeatRepository seatRepository;
    private final PaymentRepository paymentRepository;
    private final TripTravelerPreferenceRepository preferenceRepository;
    private final ObjectMapper objectMapper;
    private final PlanningDataSanitizer sanitizer;

    public TripPlanningSnapshotService(
            TripRepository tripRepository,
            UserRepository userRepository,
            RoomRepository roomRepository,
            SeatRepository seatRepository,
            PaymentRepository paymentRepository,
            TripTravelerPreferenceRepository preferenceRepository,
            ObjectMapper objectMapper,
            PlanningDataSanitizer sanitizer
    ) {
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.seatRepository = seatRepository;
        this.paymentRepository = paymentRepository;
        this.preferenceRepository = preferenceRepository;
        this.objectMapper = objectMapper;
        this.sanitizer = sanitizer;
    }

    @Transactional(readOnly = true)
    public TripPlanningSnapshot create(String tripId) {
        Trip trip = tripRepository.findById(tripId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Viagem nao encontrada.")
        );
        List<String> memberCpfs = parseTravelerCpfs(trip.getTravelersJson());
        List<Room> storedRooms = roomRepository.findByTripId(tripId);
        List<Seat> storedSeats = seatRepository.findByTripId(tripId);
        List<Payment> storedPayments = paymentRepository.findByTripId(tripId);
        List<TripTravelerPreference> storedPreferences =
                preferenceRepository.findByTripIdOrderByUserCpfAsc(tripId);

        LinkedHashSet<String> cpfOrder = new LinkedHashSet<>(memberCpfs);
        TreeSet<String> additionalCpfs = new TreeSet<>();
        storedRooms.forEach(room -> addCpfs(additionalCpfs, room.getOccupants()));
        storedSeats.forEach(seat -> addCpf(additionalCpfs, seat.getUserCpf()));
        storedPayments.forEach(payment -> addCpf(additionalCpfs, payment.getUserCpf()));
        storedPreferences.forEach(preference -> {
            addCpf(additionalCpfs, preference.getUserCpf());
            addCpfs(additionalCpfs, preference.getCompanionCpfs());
            addCpfs(additionalCpfs, preference.getSeparatedFromCpfs());
        });
        additionalCpfs.removeAll(cpfOrder);
        cpfOrder.addAll(additionalCpfs);

        Map<String, String> travelerAliases = aliases(cpfOrder, "traveler");
        Set<String> memberSet = new HashSet<>(memberCpfs);
        Map<String, User> users = new HashMap<>();
        userRepository.findAllById(cpfOrder).forEach(user -> users.put(normalizeCpf(user.getCpf()), user));
        List<String> personalNames = users.values().stream().map(User::getName).toList();

        List<RawBus> rawBuses = parseBuses(trip.getBusesJson());
        List<RawHotel> rawHotels = parseHotels(trip.getHotelsJson());
        Map<String, String> busAliases = resourceAliases(
                rawBuses.stream().map(RawBus::id).toList(),
                storedSeats.stream().map(Seat::getBusId).toList(),
                "bus"
        );
        Map<String, String> hotelAliases = resourceAliases(
                rawHotels.stream().map(RawHotel::id).toList(),
                storedRooms.stream().map(Room::getHotelId).toList(),
                "hotel"
        );
        Map<String, String> roomAliases = resourceAliases(
                rawHotels.stream().flatMap(hotel -> hotel.rooms().stream()).map(RawRoom::id).toList(),
                storedRooms.stream().map(Room::getId).toList(),
                "room"
        );

        List<TripPlanningSnapshot.Traveler> travelers = cpfOrder.stream()
                .map(cpf -> new TripPlanningSnapshot.Traveler(
                        travelerAliases.get(cpf),
                        memberSet.contains(cpf)
                ))
                .toList();

        List<TripPlanningSnapshot.FamilyLink> familyLinks = familyLinks(users, travelerAliases);
        List<TripPlanningSnapshot.Preference> preferences = preferences(
                storedPreferences,
                travelerAliases,
                personalNames
        );
        List<TripPlanningSnapshot.Bus> buses = buses(rawBuses, busAliases);
        List<TripPlanningSnapshot.Hotel> hotels = hotels(rawHotels, hotelAliases, personalNames);
        List<TripPlanningSnapshot.Room> rooms = rooms(
                rawHotels,
                storedRooms,
                roomAliases,
                hotelAliases,
                travelerAliases,
                personalNames
        );
        List<TripPlanningSnapshot.Seat> seats = seats(storedSeats, busAliases, travelerAliases);
        List<TripPlanningSnapshot.Payment> payments = payments(storedPayments, travelerAliases);

        TripPlanningSnapshot.TripContext context = new TripPlanningSnapshot.TripContext(
                sanitizer.sanitize(trip.getName(), 200, personalNames),
                sanitizer.sanitize(trip.getDestination(), 200, personalNames),
                sanitizer.sanitize(trip.getDeparturePlace(), 200, personalNames),
                sanitizer.sanitize(trip.getDepartureTime(), 20, personalNames),
                trip.getDate() == null ? "" : trip.getDate().toString(),
                safeInteger(trip.getMaxPeople()),
                safeDouble(trip.getPrice()),
                safeDouble(trip.getArrecadationGoal()),
                sanitizer.sanitize(trip.getRules(), 1000, personalNames)
        );

        TripPlanningSnapshot unsigned = new TripPlanningSnapshot(
                "",
                trip.getVersion(),
                context,
                travelers,
                familyLinks,
                preferences,
                buses,
                hotels,
                rooms,
                seats,
                payments
        );
        return new TripPlanningSnapshot(
                hash(unsigned),
                unsigned.sourceVersion(),
                unsigned.trip(),
                unsigned.travelers(),
                unsigned.familyLinks(),
                unsigned.preferences(),
                unsigned.buses(),
                unsigned.hotels(),
                unsigned.rooms(),
                unsigned.seats(),
                unsigned.payments()
        );
    }

    private List<TripPlanningSnapshot.FamilyLink> familyLinks(
            Map<String, User> users,
            Map<String, String> aliases
    ) {
        Set<String> keys = new TreeSet<>();
        List<TripPlanningSnapshot.FamilyLink> result = new ArrayList<>();
        users.forEach((cpf, user) -> {
            addFamilyLink(result, keys, "SPOUSE", cpf, user.getSpouseCpf(), aliases);
            if (user.getChildCpfs() != null) {
                user.getChildCpfs().forEach(child ->
                        addFamilyLink(result, keys, "PARENT_CHILD", cpf, child, aliases)
                );
            }
        });
        return result.stream()
                .sorted(Comparator.comparing(TripPlanningSnapshot.FamilyLink::type)
                        .thenComparing(TripPlanningSnapshot.FamilyLink::firstTraveler)
                        .thenComparing(TripPlanningSnapshot.FamilyLink::secondTraveler))
                .toList();
    }

    private void addFamilyLink(
            List<TripPlanningSnapshot.FamilyLink> result,
            Set<String> keys,
            String type,
            String firstCpf,
            String secondCpfValue,
            Map<String, String> aliases
    ) {
        String secondCpf = normalizeCpf(secondCpfValue);
        if (!aliases.containsKey(firstCpf) || !aliases.containsKey(secondCpf) || firstCpf.equals(secondCpf)) {
            return;
        }
        String first = aliases.get(firstCpf);
        String second = aliases.get(secondCpf);
        if ("SPOUSE".equals(type) && first.compareTo(second) > 0) {
            String temporary = first;
            first = second;
            second = temporary;
        }
        String key = type + "\n" + first + "\n" + second;
        if (keys.add(key)) {
            result.add(new TripPlanningSnapshot.FamilyLink(type, first, second));
        }
    }

    private List<TripPlanningSnapshot.Preference> preferences(
            List<TripTravelerPreference> stored,
            Map<String, String> aliases,
            Collection<String> personalNames
    ) {
        return stored.stream()
                .filter(preference -> aliases.containsKey(normalizeCpf(preference.getUserCpf())))
                .map(preference -> {
                    String traveler = aliases.get(normalizeCpf(preference.getUserCpf()));
                    if (!preference.isIncludeInAiPlanning()) {
                        return new TripPlanningSnapshot.Preference(
                                traveler, false, null, null, null, "", List.of(), List.of()
                        );
                    }
                    return new TripPlanningSnapshot.Preference(
                            traveler,
                            true,
                            preference.getMobilityRequirement(),
                            preference.getSeatRegion(),
                            preference.getPreferredBusFloor(),
                            sanitizer.sanitize(preference.getPreferredRoomType(), 100, personalNames),
                            relatedAliases(preference.getCompanionCpfs(), aliases),
                            relatedAliases(preference.getSeparatedFromCpfs(), aliases)
                    );
                })
                .sorted(Comparator.comparing(TripPlanningSnapshot.Preference::traveler))
                .toList();
    }

    private List<TripPlanningSnapshot.Room> rooms(
            List<RawHotel> rawHotels,
            List<Room> storedRooms,
            Map<String, String> roomAliases,
            Map<String, String> hotelAliases,
            Map<String, String> travelerAliases,
            Collection<String> personalNames
    ) {
        Map<String, RawRoom> definitions = new LinkedHashMap<>();
        rawHotels.forEach(hotel -> hotel.rooms().forEach(room -> definitions.put(room.id(), room)));
        Map<String, Room> storedById = new HashMap<>();
        storedRooms.forEach(room -> storedById.put(cleanId(room.getId()), room));

        return roomAliases.keySet().stream().map(id -> {
            RawRoom definition = definitions.get(id);
            Room stored = storedById.get(id);
            String hotelId = stored != null ? cleanId(stored.getHotelId())
                    : definition == null ? "" : definition.hotelId();
            String name = stored != null ? stored.getName() : definition == null ? "" : definition.name();
            String type = stored != null ? stored.getType() : definition == null ? "" : definition.type();
            int capacity = stored != null ? stored.getCapacity()
                    : definition == null ? 0 : definition.capacity();
            List<String> occupants = stored == null
                    ? List.of()
                    : relatedAliases(stored.getOccupants(), travelerAliases);
            return new TripPlanningSnapshot.Room(
                    roomAliases.get(id),
                    hotelAliases.getOrDefault(hotelId, "hotel_unknown"),
                    sanitizer.sanitize(name, 200, personalNames),
                    sanitizer.sanitize(type, 100, personalNames),
                    capacity,
                    occupants
            );
        }).toList();
    }

    private List<TripPlanningSnapshot.Bus> buses(
            List<RawBus> configured,
            Map<String, String> aliases
    ) {
        Map<String, RawBus> byId = new HashMap<>();
        configured.forEach(bus -> byId.put(bus.id(), bus));
        return aliases.keySet().stream().map(id -> {
            RawBus bus = byId.get(id);
            return new TripPlanningSnapshot.Bus(
                    aliases.get(id),
                    bus == null ? 0 : bus.floors(),
                    bus == null ? 0 : bus.seats(),
                    bus == null ? 0 : bus.seatsFloor1(),
                    bus == null ? 0 : bus.seatsFloor2()
            );
        }).toList();
    }

    private List<TripPlanningSnapshot.Hotel> hotels(
            List<RawHotel> configured,
            Map<String, String> aliases,
            Collection<String> personalNames
    ) {
        Map<String, RawHotel> byId = new HashMap<>();
        configured.forEach(hotel -> byId.put(hotel.id(), hotel));
        return aliases.keySet().stream().map(id -> {
            RawHotel hotel = byId.get(id);
            return new TripPlanningSnapshot.Hotel(
                    aliases.get(id),
                    hotel == null ? "" : sanitizer.sanitize(hotel.name(), 200, personalNames)
            );
        }).toList();
    }

    private List<TripPlanningSnapshot.Seat> seats(
            List<Seat> stored,
            Map<String, String> busAliases,
            Map<String, String> travelerAliases
    ) {
        List<Seat> sorted = stored.stream()
                .sorted(Comparator.comparing((Seat seat) -> cleanId(seat.getBusId()))
                        .thenComparingInt(Seat::getFloor)
                        .thenComparingInt(Seat::getSeatNumber)
                        .thenComparing(Seat::getId, Comparator.nullsFirst(String::compareTo)))
                .toList();
        List<TripPlanningSnapshot.Seat> result = new ArrayList<>();
        for (int index = 0; index < sorted.size(); index++) {
            Seat seat = sorted.get(index);
            result.add(new TripPlanningSnapshot.Seat(
                    alias("seat", index),
                    busAliases.getOrDefault(cleanId(seat.getBusId()), "bus_unknown"),
                    seat.getFloor(),
                    seat.getSeatNumber(),
                    travelerAliases.getOrDefault(normalizeCpf(seat.getUserCpf()), "traveler_unknown")
            ));
        }
        return result;
    }

    private List<TripPlanningSnapshot.Payment> payments(
            List<Payment> stored,
            Map<String, String> travelerAliases
    ) {
        List<Payment> sorted = stored.stream()
                .sorted(Comparator.comparing(
                        (Payment payment) -> travelerAliases.getOrDefault(
                                normalizeCpf(payment.getUserCpf()),
                                "traveler_unknown"
                        )
                ).thenComparing(Payment::getId, Comparator.nullsFirst(String::compareTo)))
                .toList();
        List<TripPlanningSnapshot.Payment> result = new ArrayList<>();
        for (int index = 0; index < sorted.size(); index++) {
            Payment payment = sorted.get(index);
            result.add(new TripPlanningSnapshot.Payment(
                    alias("payment", index),
                    travelerAliases.getOrDefault(normalizeCpf(payment.getUserCpf()), "traveler_unknown"),
                    payment.getTotalInstallments(),
                    payment.getPaidInstallments(),
                    payment.getDueDay(),
                    payment.isLocked()
            ));
        }
        return result;
    }

    private List<RawBus> parseBuses(String json) {
        Map<String, RawBus> result = new java.util.TreeMap<>();
        for (Map<?, ?> value : parseObjectArray(json, "onibus")) {
            String id = cleanId(value.get("id"));
            if (!id.isBlank()) {
                result.put(id, new RawBus(
                        id,
                        integer(value.get("floors")),
                        integer(value.get("seats")),
                        integer(value.get("seatsFloor1")),
                        integer(value.get("seatsFloor2"))
                ));
            }
        }
        return List.copyOf(result.values());
    }

    private List<RawHotel> parseHotels(String json) {
        Map<String, RawHotel> result = new java.util.TreeMap<>();
        for (Map<?, ?> value : parseObjectArray(json, "hoteis")) {
            String hotelId = cleanId(value.get("id"));
            if (hotelId.isBlank()) {
                continue;
            }
            List<RawRoom> rooms = new ArrayList<>();
            Object roomValues = value.get("rooms");
            if (roomValues instanceof List<?> list) {
                for (Object item : list) {
                    if (!(item instanceof Map<?, ?> room)) {
                        continue;
                    }
                    String roomId = cleanId(room.get("id"));
                    if (!roomId.isBlank()) {
                        rooms.add(new RawRoom(
                                roomId,
                                hotelId,
                                cleanText(room.get("name")),
                                cleanText(room.get("type")),
                                integer(room.get("capacity"))
                        ));
                    }
                }
            }
            rooms.sort(Comparator.comparing(RawRoom::id));
            result.put(hotelId, new RawHotel(hotelId, cleanText(value.get("name")), List.copyOf(rooms)));
        }
        return List.copyOf(result.values());
    }

    private List<Map<?, ?>> parseObjectArray(String json, String label) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?> values)) {
                throw new IllegalArgumentException();
            }
            List<Map<?, ?>> result = new ArrayList<>();
            for (Object value : values) {
                if (value instanceof Map<?, ?> map) {
                    result.add(map);
                }
            }
            return result;
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A configuracao de " + label + " esta invalida.",
                    exception
            );
        }
    }

    private List<String> parseTravelerCpfs(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?> values)) {
                throw new IllegalArgumentException();
            }
            LinkedHashSet<String> result = new LinkedHashSet<>();
            for (Object value : values) {
                String cpf = normalizeCpf(value == null ? "" : value.toString());
                if (cpf.length() != 11) {
                    throw new IllegalArgumentException();
                }
                result.add(cpf);
            }
            return List.copyOf(result);
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A lista de viajantes da viagem esta invalida.",
                    exception
            );
        }
    }

    private Map<String, String> aliases(Collection<String> values, String prefix) {
        Map<String, String> result = new LinkedHashMap<>();
        int index = 0;
        for (String value : values) {
            result.put(value, alias(prefix, index++));
        }
        return result;
    }

    private Map<String, String> resourceAliases(
            Collection<String> configured,
            Collection<String> stored,
            String prefix
    ) {
        TreeSet<String> values = new TreeSet<>();
        configured.stream().map(this::cleanId).filter(value -> !value.isBlank()).forEach(values::add);
        stored.stream().map(this::cleanId).filter(value -> !value.isBlank()).forEach(values::add);
        return aliases(values, prefix);
    }

    private String alias(String prefix, int zeroBasedIndex) {
        return "%s_%03d".formatted(prefix, zeroBasedIndex + 1);
    }

    private List<String> relatedAliases(Collection<String> cpfs, Map<String, String> aliases) {
        if (cpfs == null) {
            return List.of();
        }
        return cpfs.stream()
                .map(this::normalizeCpf)
                .map(aliases::get)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .sorted()
                .toList();
    }

    private void addCpfs(Set<String> destination, Collection<String> values) {
        if (values != null) {
            values.forEach(value -> addCpf(destination, value));
        }
    }

    private void addCpf(Set<String> destination, String value) {
        String cpf = normalizeCpf(value);
        if (cpf.length() == 11) {
            destination.add(cpf);
        }
    }

    private String normalizeCpf(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private String cleanId(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String cleanText(Object value) {
        return value == null ? "" : value.toString();
    }

    private int integer(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(cleanText(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private int safeInteger(Integer value) {
        return value == null ? 0 : value;
    }

    private double safeDouble(Double value) {
        return value == null || !Double.isFinite(value) ? 0 : value;
    }

    private String hash(TripPlanningSnapshot snapshot) {
        try {
            byte[] serialized = objectMapper.writeValueAsString(snapshot)
                    .getBytes(StandardCharsets.UTF_8);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(serialized);
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 nao esta disponivel.", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel gerar o hash do snapshot.", exception);
        }
    }

    private record RawBus(
            String id,
            int floors,
            int seats,
            int seatsFloor1,
            int seatsFloor2
    ) {
    }

    private record RawHotel(String id, String name, List<RawRoom> rooms) {
    }

    private record RawRoom(
            String id,
            String hotelId,
            String name,
            String type,
            int capacity
    ) {
    }
}
