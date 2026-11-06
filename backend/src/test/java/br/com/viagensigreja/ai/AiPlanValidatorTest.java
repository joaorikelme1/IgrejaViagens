package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiPlanValidatorTest {

    private final AiPlanValidator validator = new AiPlanValidator(new PlanningDataSanitizer());

    @Test
    void acceptsSafePlanAndSanitizesGeneratedText() {
        AiPlanResult result = validator.validate(
                snapshot(true),
                AiPlanningFocus.ALL,
                new AiPlanResult(
                        "Plano completo",
                        List.of(new AiPlanResult.RoomCreation(
                                "new_room_001", "hotel_001", "Quarto 102", "Duplo", 2,
                                "Contato 529.982.247-25"
                        )),
                        List.of(new AiPlanResult.RoomAssignment(
                                "traveler_002", "new_room_001", "Mantem a familia proxima"
                        )),
                        List.of(new AiPlanResult.SeatAssignment(
                                "traveler_002", "bus_001", 1, 2, "Atende mobilidade"
                        )),
                        List.of()
                )
        );

        assertEquals(1, result.roomCreations().size());
        assertEquals(1, result.roomAssignments().size());
        assertEquals(1, result.seatAssignments().size());
        assertTrue(result.roomCreations().get(0).reason().contains("[CPF_REMOVIDO]"));
    }

    @Test
    void rejectsDuplicateTravelerAndOccupiedSeat() {
        AiPlanResult invalid = new AiPlanResult(
                "Plano invalido",
                List.of(),
                List.of(new AiPlanResult.RoomAssignment(
                        "traveler_001", "room_001", "Ja esta no quarto"
                )),
                List.of(new AiPlanResult.SeatAssignment(
                        "traveler_002", "bus_001", 1, 1, "Assento ocupado"
                )),
                List.of()
        );

        AiPlanValidationException exception = assertThrows(
                AiPlanValidationException.class,
                () -> validator.validate(snapshot(true), AiPlanningFocus.ALL, invalid)
        );
        assertEquals("DUPLICATE_ROOM_TRAVELER", exception.getCode());
    }

    @Test
    void rejectsExcludedTravelerAndMandatoryMobilityConflict() {
        AiPlanResult excluded = new AiPlanResult(
                "Plano invalido",
                List.of(),
                List.of(),
                List.of(new AiPlanResult.SeatAssignment(
                        "traveler_002", "bus_001", 2, 1, "Piso superior"
                )),
                List.of()
        );

        AiPlanValidationException excludedError = assertThrows(
                AiPlanValidationException.class,
                () -> validator.validate(snapshot(false), AiPlanningFocus.SEATS, excluded)
        );
        assertEquals("INELIGIBLE_TRAVELER", excludedError.getCode());

        AiPlanValidationException mobilityError = assertThrows(
                AiPlanValidationException.class,
                () -> validator.validate(snapshot(true), AiPlanningFocus.SEATS, excluded)
        );
        assertEquals("MOBILITY_CONFLICT", mobilityError.getCode());
    }

    private TripPlanningSnapshot snapshot(boolean includeSecondTraveler) {
        return new TripPlanningSnapshot(
                "a".repeat(64),
                1L,
                new TripPlanningSnapshot.TripContext(
                        "Retiro", "Destino", "Origem", "08:00", "2027-01-20",
                        2, 100.0, 200.0, ""
                ),
                List.of(
                        new TripPlanningSnapshot.Traveler("traveler_001", true),
                        new TripPlanningSnapshot.Traveler("traveler_002", true)
                ),
                List.of(),
                List.of(new TripPlanningSnapshot.Preference(
                        "traveler_002",
                        includeSecondTraveler,
                        includeSecondTraveler ? MobilityRequirement.REQUIRE_LOWER_FLOOR : null,
                        includeSecondTraveler ? SeatRegion.FRONT : null,
                        includeSecondTraveler ? 1 : null,
                        "",
                        List.of(),
                        List.of()
                )),
                List.of(new TripPlanningSnapshot.Bus("bus_001", 2, 4, 2, 2)),
                List.of(new TripPlanningSnapshot.Hotel("hotel_001", "Hotel Central")),
                List.of(new TripPlanningSnapshot.Room(
                        "room_001", "hotel_001", "101", "Duplo", 2,
                        List.of("traveler_001")
                )),
                List.of(new TripPlanningSnapshot.Seat(
                        "seat_001", "bus_001", 1, 1, "traveler_001"
                ))
        );
    }
}
