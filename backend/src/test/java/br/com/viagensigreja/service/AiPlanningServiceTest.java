package br.com.viagensigreja.service;

import br.com.viagensigreja.ai.AiPlanResult;
import br.com.viagensigreja.ai.AiPlanValidator;
import br.com.viagensigreja.ai.AiPlanningFocus;
import br.com.viagensigreja.ai.AiPlanningProvider;
import br.com.viagensigreja.ai.AiPlanningProperties;
import br.com.viagensigreja.ai.AiProviderResponse;
import br.com.viagensigreja.ai.TripPlanningContext;
import br.com.viagensigreja.ai.TripPlanningSnapshot;
import br.com.viagensigreja.ai.TripPlanningSnapshotService;
import br.com.viagensigreja.model.AiPlan;
import br.com.viagensigreja.model.AiPlanStatus;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.dto.AiPlanGenerationRequest;
import br.com.viagensigreja.repository.AiPlanRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiPlanningServiceTest {

    @Test
    void startsDailyUsageWindowAtMidnightInConfiguredTimeZone() {
        AiPlanningProperties properties = new AiPlanningProperties();
        properties.setUsageTimeZone(ZoneId.of("America/Sao_Paulo"));
        AiPlanningService service = new AiPlanningService(
                mock(AiPlanRepository.class),
                mock(TripRepository.class),
                mock(RoomRepository.class),
                mock(SeatRepository.class),
                mock(TripPlanningSnapshotService.class),
                mock(AiPlanningProvider.class),
                mock(AiPlanValidator.class),
                mock(RoomService.class),
                mock(SeatService.class),
                new ObjectMapper(),
                properties
        );

        assertEquals(
                Instant.parse("2026-11-05T03:00:00Z"),
                service.startOfUsageDay(Instant.parse("2026-11-05T12:00:00Z"))
        );
    }

    @Test
    void calculatesAndValidatesPlanSynchronously() {
        AiPlanRepository planRepository = mock(AiPlanRepository.class);
        TripRepository tripRepository = mock(TripRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        SeatRepository seatRepository = mock(SeatRepository.class);
        TripPlanningSnapshotService snapshotService = mock(TripPlanningSnapshotService.class);
        AiPlanningProvider provider = mock(AiPlanningProvider.class);
        AiPlanValidator validator = mock(AiPlanValidator.class);
        RoomService roomService = mock(RoomService.class);
        SeatService seatService = mock(SeatService.class);
        ObjectMapper objectMapper = new ObjectMapper();
        AiPlanningProperties properties = new AiPlanningProperties();
        TripPlanningSnapshot snapshot = snapshot();
        TripPlanningContext context = new TripPlanningContext(
                snapshot,
                Map.of("traveler_001", "52998224725"),
                Map.of("bus_001", "bus-real"),
                Map.of("hotel_001", "hotel-real"),
                Map.of(),
                Map.of("traveler_001", "Ana"),
                Map.of("bus_001", "Onibus 1"),
                Map.of("hotel_001", "Hotel Central"),
                Map.of()
        );
        AiPlanResult result = new AiPlanResult(
                "Plano pronto", List.of(), List.of(), List.of(), List.of()
        );

        when(provider.isConfigured()).thenReturn(true);
        when(provider.providerName()).thenReturn("local");
        when(provider.configuredModel()).thenReturn("planejador-deterministico-v1");
        when(snapshotService.createContext("trip-1")).thenReturn(context);
        when(provider.generate(snapshot, AiPlanningFocus.ALL)).thenReturn(
                new AiProviderResponse(result, "planejador-deterministico-v1", null, null)
        );
        when(validator.validate(snapshot, AiPlanningFocus.ALL, result)).thenReturn(result);
        when(planRepository.save(any(AiPlan.class))).thenAnswer(invocation -> {
            AiPlan value = invocation.getArgument(0);
            if (value.getCreatedAt() == null) {
                value.setCreatedAt(Instant.now());
            }
            value.setUpdatedAt(Instant.now());
            return value;
        });

        AiPlanningService service = new AiPlanningService(
                planRepository, tripRepository, roomRepository, seatRepository,
                snapshotService, provider, validator, roomService, seatService,
                objectMapper, properties
        );

        var generated = service.generate(
                "52998224725",
                new AiPlanGenerationRequest("trip-1", AiPlanningFocus.ALL)
        );
        assertEquals(AiPlanStatus.GENERATED, generated.status());
        assertEquals("local", generated.provider());
        assertEquals(null, generated.inputTokens());
        assertEquals("Plano pronto", generated.result().summary());
    }

    @Test
    void blocksGenerationWhenAdministratorHourlyLimitIsReached() {
        AiPlanRepository planRepository = mock(AiPlanRepository.class);
        AiPlanningProvider provider = mock(AiPlanningProvider.class);
        AiPlanningProperties properties = new AiPlanningProperties();
        when(provider.isConfigured()).thenReturn(true);
        when(planRepository.countByCreatedByCpfAndCreatedAtAfter(eq("52998224725"), any()))
                .thenReturn((long) properties.getMaxRequestsPerAdminPerHour());

        AiPlanningService service = new AiPlanningService(
                planRepository,
                mock(TripRepository.class),
                mock(RoomRepository.class),
                mock(SeatRepository.class),
                mock(TripPlanningSnapshotService.class),
                provider,
                mock(AiPlanValidator.class),
                mock(RoomService.class),
                mock(SeatService.class),
                new ObjectMapper(),
                properties
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.generate(
                        "52998224725",
                        new AiPlanGenerationRequest("trip-1", AiPlanningFocus.ALL)
                )
        );
        assertEquals(429, exception.getStatusCode().value());
    }

    @Test
    void appliesValidatedPlanToRoomsSeatsAndHotelStructure() throws Exception {
        AiPlanRepository planRepository = mock(AiPlanRepository.class);
        TripRepository tripRepository = mock(TripRepository.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        SeatRepository seatRepository = mock(SeatRepository.class);
        TripPlanningSnapshotService snapshotService = mock(TripPlanningSnapshotService.class);
        AiPlanningProvider provider = mock(AiPlanningProvider.class);
        AiPlanValidator validator = mock(AiPlanValidator.class);
        RoomService roomService = mock(RoomService.class);
        SeatService seatService = mock(SeatService.class);
        ObjectMapper objectMapper = new ObjectMapper();

        TripPlanningSnapshot snapshot = snapshot();
        TripPlanningContext context = new TripPlanningContext(
                snapshot,
                Map.of("traveler_001", "52998224725"),
                Map.of("bus_001", "bus-real"),
                Map.of("hotel_001", "hotel-real"),
                Map.of(),
                Map.of("traveler_001", "Ana"),
                Map.of("bus_001", "Onibus 1"),
                Map.of("hotel_001", "Hotel Central"),
                Map.of()
        );
        AiPlanResult result = new AiPlanResult(
                "Plano seguro",
                List.of(new AiPlanResult.RoomCreation(
                        "new_room_001", "hotel_001", "102", "Duplo", 2, ""
                )),
                List.of(new AiPlanResult.RoomAssignment(
                        "traveler_001", "new_room_001", ""
                )),
                List.of(new AiPlanResult.SeatAssignment(
                        "traveler_001", "bus_001", 1, 2, ""
                )),
                List.of()
        );
        AiPlan plan = new AiPlan();
        plan.setId("plan-1");
        plan.setTripId("trip-1");
        plan.setStatus(AiPlanStatus.GENERATED);
        plan.setFocus(AiPlanningFocus.ALL.name());
        plan.setSnapshotHash(snapshot.snapshotHash());
        plan.setResultJson(objectMapper.writeValueAsString(result));
        plan.setCreatedAt(Instant.now());
        plan.setUpdatedAt(Instant.now());

        Trip trip = new Trip();
        trip.setId("trip-1");
        trip.setHotelsJson("[{\"id\":\"hotel-real\",\"name\":\"Hotel Central\",\"rooms\":[]}]");

        when(planRepository.findById(plan.getId())).thenReturn(Optional.of(plan));
        when(planRepository.findByTripIdAndStatusOrderByCreatedAtDesc(
                plan.getTripId(), AiPlanStatus.GENERATED
        )).thenReturn(List.of(plan));
        when(snapshotService.createContext(plan.getTripId())).thenReturn(context);
        when(validator.validate(snapshot, AiPlanningFocus.ALL, result)).thenReturn(result);
        when(roomRepository.findByTripId(plan.getTripId())).thenReturn(List.of());
        when(seatRepository.findByTripId(plan.getTripId())).thenReturn(List.of());
        when(tripRepository.findById(plan.getTripId())).thenReturn(Optional.of(trip));
        when(planRepository.save(any(AiPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AiPlanningService service = new AiPlanningService(
                planRepository,
                tripRepository,
                roomRepository,
                seatRepository,
                snapshotService,
                provider,
                validator,
                roomService,
                seatService,
                objectMapper,
                new AiPlanningProperties()
        );

        var applied = service.apply(plan.getId());

        assertEquals(1, applied.roomsCreated());
        assertEquals(1, applied.travelersAssignedToRooms());
        assertEquals(1, applied.travelersAssignedToSeats());
        assertEquals(AiPlanStatus.APPLIED, plan.getStatus());
        assertTrue(trip.getHotelsJson().contains("room_ai_"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Room>> rooms = ArgumentCaptor.forClass(List.class);
        verify(roomService).substituirDaViagem(eq("trip-1"), rooms.capture());
        assertEquals(List.of("52998224725"), rooms.getValue().get(0).getOccupants());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Seat>> seats = ArgumentCaptor.forClass(List.class);
        verify(seatService).substituirDaViagem(eq("trip-1"), seats.capture());
        assertEquals("bus-real", seats.getValue().get(0).getBusId());
        assertEquals("52998224725", seats.getValue().get(0).getUserCpf());
    }

    private TripPlanningSnapshot snapshot() {
        return new TripPlanningSnapshot(
                "a".repeat(64),
                1L,
                new TripPlanningSnapshot.TripContext(
                        "Retiro", "Destino", "Origem", "08:00", "2027-01-20",
                        1, 100.0, 100.0, ""
                ),
                List.of(new TripPlanningSnapshot.Traveler("traveler_001", true)),
                List.of(),
                List.of(),
                List.of(new TripPlanningSnapshot.Bus("bus_001", 1, 10, 10, 0)),
                List.of(new TripPlanningSnapshot.Hotel("hotel_001", "Hotel Central")),
                List.of(),
                List.of()
        );
    }
}
