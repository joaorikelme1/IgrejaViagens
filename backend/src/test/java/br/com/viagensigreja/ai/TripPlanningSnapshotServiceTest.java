package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.model.SeatRegion;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.TripTravelerPreferenceRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TripPlanningSnapshotServiceTest {

    private static final String FIRST_CPF = "52998224725";
    private static final String SECOND_CPF = "11144477735";

    @Test
    void createsStableSnapshotWithoutPersonalIdentifiersOrPrivatePayloads() throws Exception {
        TripRepository tripRepository = mock(TripRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        SeatRepository seatRepository = mock(SeatRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        TripTravelerPreferenceRepository preferenceRepository =
                mock(TripTravelerPreferenceRepository.class);

        Trip trip = trip();
        User first = user(FIRST_CPF, "Ana Segredo", SECOND_CPF, Set.of(SECOND_CPF));
        User second = user(SECOND_CPF, "Bruno Segredo", FIRST_CPF, Set.of());
        Room room = new Room(
                "room-real", "Casal", 2, "Quarto Ana", "hotel-real",
                List.of(FIRST_CPF), trip.getId()
        );
        Seat seat = new Seat("seat-real", trip.getId(), "bus-real", 1, 1, FIRST_CPF);
        Payment payment = new Payment(
                "payment-real", FIRST_CPF, trip.getId(), 5, 2, 10, false,
                "{\"privateReceipt\":\"" + FIRST_CPF + "\"}"
        );
        TripTravelerPreference preference = new TripTravelerPreference();
        preference.setId("preference-real");
        preference.setTripId(trip.getId());
        preference.setUserCpf(FIRST_CPF);
        preference.setMobilityRequirement(MobilityRequirement.REQUIRE_LOWER_FLOOR);
        preference.setSeatRegion(SeatRegion.FRONT);
        preference.setPreferredBusFloor(1);
        preference.setPreferredRoomType("Casal");
        preference.setIncludeInAiPlanning(true);
        preference.setCompanionCpfs(new LinkedHashSet<>(Set.of(SECOND_CPF)));

        when(tripRepository.findById(trip.getId())).thenReturn(Optional.of(trip));
        when(userRepository.findAllById(any())).thenReturn(List.of(first, second));
        when(roomRepository.findByTripId(trip.getId())).thenReturn(List.of(room));
        when(seatRepository.findByTripId(trip.getId())).thenReturn(List.of(seat));
        when(paymentRepository.findByTripId(trip.getId())).thenReturn(List.of(payment));
        when(preferenceRepository.findByTripIdOrderByUserCpfAsc(trip.getId()))
                .thenReturn(List.of(preference));

        ObjectMapper objectMapper = new ObjectMapper();
        TripPlanningSnapshotService service = new TripPlanningSnapshotService(
                tripRepository,
                userRepository,
                roomRepository,
                seatRepository,
                paymentRepository,
                preferenceRepository,
                objectMapper,
                new PlanningDataSanitizer()
        );

        TripPlanningSnapshot firstSnapshot = service.create(trip.getId());
        TripPlanningSnapshot secondSnapshot = service.create(trip.getId());
        String json = objectMapper.writeValueAsString(firstSnapshot);

        assertEquals(firstSnapshot.snapshotHash(), secondSnapshot.snapshotHash());
        assertEquals(64, firstSnapshot.snapshotHash().length());
        assertEquals(7L, firstSnapshot.sourceVersion());
        assertEquals(List.of("traveler_001", "traveler_002"),
                firstSnapshot.travelers().stream().map(TripPlanningSnapshot.Traveler::alias).toList());
        assertEquals("bus_001", firstSnapshot.seats().get(0).bus());
        assertEquals("traveler_001", firstSnapshot.rooms().get(0).occupants().get(0));
        assertTrue(json.contains("[CPF_REMOVIDO]"));
        assertTrue(json.contains("[EMAIL_REMOVIDO]"));
        assertTrue(json.contains("[TELEFONE_REMOVIDO]"));
        assertFalse(json.contains(FIRST_CPF));
        assertFalse(json.contains(SECOND_CPF));
        assertFalse(json.contains("Ana Segredo"));
        assertFalse(json.contains("Bruno Segredo"));
        assertFalse(json.contains("Quarto Ana"));
        assertTrue(json.contains("[NOME_REMOVIDO]"));
        assertFalse(json.contains("privateReceipt"));
    }

    @Test
    void hidesOperationalPreferenceWhenTravelerIsExcludedFromAiPlanning() {
        TripRepository tripRepository = mock(TripRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        SeatRepository seatRepository = mock(SeatRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        TripTravelerPreferenceRepository preferenceRepository =
                mock(TripTravelerPreferenceRepository.class);
        Trip trip = trip();
        TripTravelerPreference preference = new TripTravelerPreference();
        preference.setTripId(trip.getId());
        preference.setUserCpf(FIRST_CPF);
        preference.setIncludeInAiPlanning(false);
        preference.setMobilityRequirement(MobilityRequirement.REQUIRE_LOWER_FLOOR);
        preference.setPreferredRoomType("Informacao privada");

        when(tripRepository.findById(trip.getId())).thenReturn(Optional.of(trip));
        when(userRepository.findAllById(any())).thenReturn(List.of());
        when(roomRepository.findByTripId(trip.getId())).thenReturn(List.of());
        when(seatRepository.findByTripId(trip.getId())).thenReturn(List.of());
        when(paymentRepository.findByTripId(trip.getId())).thenReturn(List.of());
        when(preferenceRepository.findByTripIdOrderByUserCpfAsc(trip.getId()))
                .thenReturn(List.of(preference));

        TripPlanningSnapshot snapshot = new TripPlanningSnapshotService(
                tripRepository,
                userRepository,
                roomRepository,
                seatRepository,
                paymentRepository,
                preferenceRepository,
                new ObjectMapper(),
                new PlanningDataSanitizer()
        ).create(trip.getId());

        TripPlanningSnapshot.Preference sanitized = snapshot.preferences().get(0);
        assertFalse(sanitized.includedInAiPlanning());
        assertEquals(null, sanitized.mobilityRequirement());
        assertEquals("", sanitized.preferredRoomType());
        assertTrue(sanitized.companions().isEmpty());
    }

    private Trip trip() {
        Trip trip = new Trip(
                "trip-1",
                "Retiro",
                "Caldas Novas",
                "Brasilia",
                "08:00",
                LocalDate.of(2027, 1, 20),
                2,
                800.0,
                1600.0,
                "Contato ana@example.com, CPF 529.982.247-25, telefone (61) 99999-0000",
                "[{\"id\":\"bus-real\",\"floors\":1,\"seats\":2,\"seatsFloor1\":2,\"seatsFloor2\":0}]",
                "[{\"id\":\"hotel-real\",\"name\":\"Hotel Central\",\"rooms\":[{\"id\":\"room-real\",\"name\":\"Quarto Ana\",\"type\":\"Casal\",\"capacity\":2}]}]",
                "[\"" + FIRST_CPF + "\",\"" + SECOND_CPF + "\"]"
        );
        trip.setVersion(7L);
        return trip;
    }

    private User user(String cpf, String name, String spouseCpf, Set<String> childCpfs) {
        User user = new User();
        user.setCpf(cpf);
        user.setName(name);
        user.setPassword("senha-que-nao-pode-sair");
        user.setBirthdate("1990-01-01");
        user.setProfilePhoto("foto-que-nao-pode-sair");
        user.setSpouseCpf(spouseCpf);
        user.setChildCpfs(childCpfs);
        return user;
    }
}
