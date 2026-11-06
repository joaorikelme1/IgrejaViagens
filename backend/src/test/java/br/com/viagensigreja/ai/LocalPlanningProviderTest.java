package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalPlanningProviderTest {

    private final AiPlanningProperties properties = new AiPlanningProperties();
    private final LocalPlanningProvider provider = new LocalPlanningProvider(properties);

    @Test
    void createsDeterministicSafePlanRespectingFamilyMobilityAndExclusion() {
        TripPlanningSnapshot snapshot = snapshot();

        AiProviderResponse first = provider.generate(snapshot, AiPlanningFocus.ALL);
        AiProviderResponse second = provider.generate(snapshot, AiPlanningFocus.ALL);
        AiPlanResult result = new AiPlanValidator(new PlanningDataSanitizer())
                .validate(snapshot, AiPlanningFocus.ALL, first.result());

        assertEquals(first.result(), second.result());
        assertEquals(LocalPlanningProvider.PROVIDER, provider.providerName());
        assertEquals(LocalPlanningProvider.MODEL, first.model());
        assertTrue(result.roomAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_002")
                        && assignment.room().equals("room_001")
        ));
        assertTrue(result.roomCreations().stream().anyMatch(room ->
                room.key().equals("new_room_001")
        ));
        assertTrue(result.roomAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_003")
                        && assignment.room().equals("new_room_001")
        ));
        assertTrue(result.seatAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_002")
                        && assignment.floor() == 1
                        && assignment.seatNumber() == 2
        ));
        assertTrue(result.seatAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_003")
                        && assignment.seatNumber() >= 5
        ));
        assertFalse(result.roomAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_004")
        ));
        assertFalse(result.seatAssignments().stream().anyMatch(assignment ->
                assignment.traveler().equals("traveler_004")
        ));
    }

    @Test
    void respectsRequestedPlanningFocus() {
        AiPlanResult rooms = provider.generate(snapshot(), AiPlanningFocus.ROOMS).result();
        AiPlanResult seats = provider.generate(snapshot(), AiPlanningFocus.SEATS).result();

        assertTrue(rooms.seatAssignments().isEmpty());
        assertTrue(seats.roomCreations().isEmpty());
        assertTrue(seats.roomAssignments().isEmpty());
    }

    @Test
    void createsOneCompatibleRoomForAnUnassignedFamily() {
        TripPlanningSnapshot source = snapshot();
        TripPlanningSnapshot withoutRooms = new TripPlanningSnapshot(
                source.snapshotHash(),
                source.sourceVersion(),
                source.trip(),
                source.travelers(),
                source.familyLinks(),
                source.preferences(),
                source.buses(),
                source.hotels(),
                List.of(),
                source.seats()
        );

        AiPlanResult result = provider.generate(withoutRooms, AiPlanningFocus.ROOMS).result();
        String firstRoom = result.roomAssignments().stream()
                .filter(assignment -> assignment.traveler().equals("traveler_001"))
                .findFirst()
                .orElseThrow()
                .room();
        String secondRoom = result.roomAssignments().stream()
                .filter(assignment -> assignment.traveler().equals("traveler_002"))
                .findFirst()
                .orElseThrow()
                .room();

        assertEquals(firstRoom, secondRoom);
        assertEquals(2, result.roomCreations().stream()
                .filter(room -> room.key().equals(firstRoom))
                .findFirst()
                .orElseThrow()
                .capacity());
    }

    @Test
    void canBeDisabledWithoutAnyExternalCredential() {
        properties.setEnabled(false);
        assertFalse(provider.isConfigured());
        properties.setEnabled(true);
        assertTrue(provider.isConfigured());
    }

    private TripPlanningSnapshot snapshot() {
        return new TripPlanningSnapshot(
                "a".repeat(64),
                1L,
                new TripPlanningSnapshot.TripContext(
                        "Retiro", "Destino", "Origem", "08:00", "2027-01-20",
                        4, 100.0, 400.0, ""
                ),
                List.of(
                        new TripPlanningSnapshot.Traveler("traveler_001", true),
                        new TripPlanningSnapshot.Traveler("traveler_002", true),
                        new TripPlanningSnapshot.Traveler("traveler_003", true),
                        new TripPlanningSnapshot.Traveler("traveler_004", true)
                ),
                List.of(new TripPlanningSnapshot.FamilyLink(
                        "PARENT_CHILD", "traveler_001", "traveler_002"
                )),
                List.of(
                        new TripPlanningSnapshot.Preference(
                                "traveler_002", true,
                                MobilityRequirement.REQUIRE_LOWER_FLOOR,
                                SeatRegion.FRONT, 1, "Familia",
                                List.of("traveler_001"), List.of()
                        ),
                        new TripPlanningSnapshot.Preference(
                                "traveler_003", true,
                                MobilityRequirement.NONE,
                                SeatRegion.BACK, null, "Individual",
                                List.of(), List.of("traveler_001")
                        ),
                        new TripPlanningSnapshot.Preference(
                                "traveler_004", false,
                                null, null, null, "",
                                List.of(), List.of()
                        )
                ),
                List.of(new TripPlanningSnapshot.Bus("bus_001", 1, 6, 6, 0)),
                List.of(new TripPlanningSnapshot.Hotel("hotel_001", "Hotel Central")),
                List.of(new TripPlanningSnapshot.Room(
                        "room_001", "hotel_001", "101", "Familia", 3,
                        List.of("traveler_001")
                )),
                List.of(new TripPlanningSnapshot.Seat(
                        "seat_001", "bus_001", 1, 1, "traveler_001"
                ))
        );
    }
}
