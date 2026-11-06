package br.com.viagensigreja.service;

import br.com.viagensigreja.ai.AiPlanResult;
import br.com.viagensigreja.ai.AiPlanValidationException;
import br.com.viagensigreja.ai.AiPlanValidator;
import br.com.viagensigreja.ai.AiPlanningFocus;
import br.com.viagensigreja.ai.AiPlanningProvider;
import br.com.viagensigreja.ai.AiPlanningProperties;
import br.com.viagensigreja.ai.AiProviderResponse;
import br.com.viagensigreja.ai.TripPlanningContext;
import br.com.viagensigreja.ai.TripPlanningSnapshotService;
import br.com.viagensigreja.dto.AiPlanApplicationResponse;
import br.com.viagensigreja.dto.AiPlanGenerationRequest;
import br.com.viagensigreja.dto.AiPlanResponse;
import br.com.viagensigreja.dto.AiPlanningStatusResponse;
import br.com.viagensigreja.dto.AiUsageResponse;
import br.com.viagensigreja.model.AiPlan;
import br.com.viagensigreja.model.AiPlanStatus;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.repository.AiPlanRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AiPlanningService {

    static final String PLANNER_VERSION = "deterministic-planner-v1";

    private final AiPlanRepository planRepository;
    private final TripRepository tripRepository;
    private final RoomRepository roomRepository;
    private final SeatRepository seatRepository;
    private final TripPlanningSnapshotService snapshotService;
    private final AiPlanningProvider provider;
    private final AiPlanValidator validator;
    private final RoomService roomService;
    private final SeatService seatService;
    private final ObjectMapper objectMapper;
    private final AiPlanningProperties properties;

    public AiPlanningService(
            AiPlanRepository planRepository,
            TripRepository tripRepository,
            RoomRepository roomRepository,
            SeatRepository seatRepository,
            TripPlanningSnapshotService snapshotService,
            AiPlanningProvider provider,
            AiPlanValidator validator,
            RoomService roomService,
            SeatService seatService,
            ObjectMapper objectMapper,
            AiPlanningProperties properties
    ) {
        this.planRepository = planRepository;
        this.tripRepository = tripRepository;
        this.roomRepository = roomRepository;
        this.seatRepository = seatRepository;
        this.snapshotService = snapshotService;
        this.provider = provider;
        this.validator = validator;
        this.roomService = roomService;
        this.seatService = seatService;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public AiPlanningStatusResponse status() {
        return new AiPlanningStatusResponse(
                provider.isConfigured(),
                provider.providerName(),
                provider.configuredModel(),
                properties.getGenerationCooldown().toSeconds(),
                properties.getMaxRequestsPerAdminPerHour(),
                properties.getMaxRequestsPerTripPerDay()
        );
    }

    @Transactional(readOnly = true)
    public AiUsageResponse usage(String tripIdValue) {
        String tripId = required(tripIdValue, "Viagem");
        snapshotService.createContext(tripId);
        Instant startOfDay = startOfUsageDay(Instant.now());
        return new AiUsageResponse(
                tripId,
                planRepository.countByTripIdAndCreatedAtAfter(tripId, startOfDay),
                properties.getMaxRequestsPerTripPerDay(),
                planRepository.countByTripIdAndStatusIn(
                        tripId,
                        List.of(AiPlanStatus.DRAFT, AiPlanStatus.GENERATING)
                )
        );
    }

    @Transactional(readOnly = true)
    public List<AiPlanResponse> list(String tripId) {
        TripPlanningContext context = snapshotService.createContext(required(tripId, "Viagem"));
        return planRepository.findByTripIdOrderByCreatedAtDesc(tripId).stream()
                .map(plan -> response(plan, context))
                .toList();
    }

    @Transactional(readOnly = true)
    public AiPlanResponse get(String planId) {
        AiPlan plan = requirePlan(planId);
        return response(plan, snapshotService.createContext(plan.getTripId()));
    }

    public AiPlanResponse generate(String creatorCpf, AiPlanGenerationRequest request) {
        if (!provider.isConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "O planejador automatico esta desativado no servidor."
            );
        }
        if (request == null) {
            throw badRequest("Os dados para geracao do plano sao obrigatorios.");
        }
        String tripId = required(request.tripId(), "Viagem");
        String normalizedCreatorCpf = required(creatorCpf, "Administrador");
        enforceUsageLimits(normalizedCreatorCpf, tripId);
        AiPlanningFocus focus = request.focus() == null ? AiPlanningFocus.ALL : request.focus();
        TripPlanningContext context = snapshotService.createContext(tripId);

        AiPlan plan = new AiPlan();
        plan.setId("ai_plan_" + UUID.randomUUID());
        plan.setTripId(tripId);
        plan.setCreatedByCpf(normalizedCreatorCpf);
        plan.setStatus(AiPlanStatus.DRAFT);
        plan.setProvider(provider.providerName());
        plan.setModel(provider.configuredModel());
        plan.setPromptVersion(PLANNER_VERSION);
        plan.setFocus(focus.name());
        plan.setSnapshotHash(context.snapshot().snapshotHash());
        try {
            plan = planRepository.save(plan);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("Ja existe uma proposta sendo gerada para esta viagem.");
        }

        try {
            AiProviderResponse generated = provider.generate(context.snapshot(), focus);
            plan = completeGeneration(plan, context, focus, generated);
            return response(plan, context);
        } catch (AiPlanValidationException exception) {
            saveFailure(plan, exception.getCode());
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "O planejador produziu uma proposta inconsistente; nenhuma alteracao foi aplicada."
            );
        } catch (Exception exception) {
            saveFailure(plan, "PLAN_PROCESSING_FAILED");
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Nao foi possivel processar o plano gerado."
            );
        }
    }

    private AiPlan completeGeneration(
            AiPlan plan,
            TripPlanningContext context,
            AiPlanningFocus focus,
            AiProviderResponse generated
    ) throws Exception {
        if (generated == null || generated.result() == null) {
            throw new IllegalStateException("O planejador retornou uma proposta invalida.");
        }
        AiPlanResult validated = validator.validate(
                context.snapshot(),
                focus,
                generated.result()
        );
        plan.setResultJson(objectMapper.writeValueAsString(validated));
        plan.setModel(generated.model());
        plan.setInputTokens(generated.inputTokens());
        plan.setOutputTokens(generated.outputTokens());
        plan.setEstimatedCost(null);
        plan.setStatus(AiPlanStatus.GENERATED);
        plan.setErrorCode(null);
        return planRepository.save(plan);
    }

    private void enforceUsageLimits(String creatorCpf, String tripId) {
        Instant now = Instant.now();
        long active = planRepository.countByTripIdAndStatusIn(
                tripId,
                List.of(AiPlanStatus.DRAFT, AiPlanStatus.GENERATING)
        );
        if (active > 0) {
            throw conflict("Ja existe uma proposta sendo gerada para esta viagem.");
        }

        planRepository.findFirstByCreatedByCpfOrderByCreatedAtDesc(creatorCpf)
                .filter(last -> last.getCreatedAt() != null)
                .filter(last -> last.getCreatedAt().plus(properties.getGenerationCooldown()).isAfter(now))
                .ifPresent(last -> {
                    long remaining = Math.max(
                            1,
                            java.time.Duration.between(
                                    now,
                                    last.getCreatedAt().plus(properties.getGenerationCooldown())
                            ).toSeconds()
                    );
                    throw tooManyRequests(
                            "Aguarde " + remaining + " segundo(s) antes de gerar outra proposta."
                    );
                });

        if (planRepository.countByCreatedByCpfAndCreatedAtAfter(
                creatorCpf,
                now.minus(1, ChronoUnit.HOURS)
        ) >= properties.getMaxRequestsPerAdminPerHour()) {
            throw tooManyRequests("O limite horario de propostas deste administrador foi atingido.");
        }

        Instant startOfDay = startOfUsageDay(now);
        if (planRepository.countByTripIdAndCreatedAtAfter(
                tripId,
                startOfDay
        ) >= properties.getMaxRequestsPerTripPerDay()) {
            throw tooManyRequests("O limite diario de propostas desta viagem foi atingido.");
        }

    }

    Instant startOfUsageDay(Instant instant) {
        return instant.atZone(properties.getUsageTimeZone())
                .toLocalDate()
                .atStartOfDay(properties.getUsageTimeZone())
                .toInstant();
    }

    @Transactional
    public AiPlanApplicationResponse apply(String planId) {
        AiPlan plan = requirePlan(planId);
        if (plan.getStatus() != AiPlanStatus.GENERATED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Somente um plano gerado e ainda nao aplicado pode ser confirmado."
            );
        }

        TripPlanningContext context = snapshotService.createContext(plan.getTripId());
        if (!plan.getSnapshotHash().equals(context.snapshot().snapshotHash())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A viagem mudou depois da geracao. Gere um novo plano antes de aplicar."
            );
        }
        AiPlanningFocus focus = parseFocus(plan.getFocus());
        AiPlanResult result;
        try {
            result = validator.validate(
                    context.snapshot(),
                    focus,
                    readResult(plan)
            );
        } catch (AiPlanValidationException exception) {
            throw conflict("O plano salvo nao e mais considerado seguro para aplicacao.");
        }

        Map<String, Room> roomsById = new LinkedHashMap<>();
        roomRepository.findByTripId(plan.getTripId()).stream()
                .map(this::copyRoom)
                .forEach(room -> roomsById.put(room.getId(), room));
        Map<String, String> plannedRoomIds = new LinkedHashMap<>();
        List<CreatedRoom> createdRooms = new ArrayList<>();
        for (AiPlanResult.RoomCreation creation : result.roomCreations()) {
            String hotelId = context.hotelIdByAlias().get(creation.hotel());
            if (hotelId == null) {
                throw conflict("O hotel proposto nao existe mais.");
            }
            String roomId = "room_ai_" + UUID.randomUUID();
            Room room = new Room(
                    roomId,
                    creation.type(),
                    creation.capacity(),
                    creation.name(),
                    hotelId,
                    new ArrayList<>(),
                    plan.getTripId()
            );
            roomsById.put(roomId, room);
            plannedRoomIds.put(creation.key(), roomId);
            createdRooms.add(new CreatedRoom(hotelId, room));
        }

        for (AiPlanResult.RoomAssignment assignment : result.roomAssignments()) {
            String roomId = context.roomIdByAlias().get(assignment.room());
            if (roomId == null) {
                roomId = plannedRoomIds.get(assignment.room());
            }
            Room room = roomsById.get(roomId);
            String cpf = context.travelerCpfByAlias().get(assignment.traveler());
            if (room == null || cpf == null) {
                throw conflict("A proposta de hospedagem nao corresponde mais a viagem.");
            }
            room.getOccupants().add(cpf);
        }

        List<Seat> seats = seatRepository.findByTripId(plan.getTripId()).stream()
                .map(this::copySeat)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        for (AiPlanResult.SeatAssignment assignment : result.seatAssignments()) {
            String busId = context.busIdByAlias().get(assignment.bus());
            String cpf = context.travelerCpfByAlias().get(assignment.traveler());
            if (busId == null || cpf == null) {
                throw conflict("A proposta de transporte nao corresponde mais a viagem.");
            }
            seats.add(new Seat(
                    "seat_ai_" + UUID.randomUUID(),
                    plan.getTripId(),
                    busId,
                    assignment.floor(),
                    assignment.seatNumber(),
                    cpf
            ));
        }

        if (!result.roomCreations().isEmpty() || !result.roomAssignments().isEmpty()) {
            if (!createdRooms.isEmpty()) {
                addRoomsToTrip(plan.getTripId(), createdRooms);
            }
            roomService.substituirDaViagem(plan.getTripId(), new ArrayList<>(roomsById.values()));
        }
        if (!result.seatAssignments().isEmpty()) {
            seatService.substituirDaViagem(plan.getTripId(), seats);
        }

        plan.setStatus(AiPlanStatus.APPLIED);
        plan.setAppliedAt(Instant.now());
        planRepository.save(plan);
        planRepository.findByTripIdAndStatusOrderByCreatedAtDesc(
                plan.getTripId(),
                AiPlanStatus.GENERATED
        ).stream()
                .filter(other -> !other.getId().equals(plan.getId()))
                .forEach(other -> other.setStatus(AiPlanStatus.STALE));

        return new AiPlanApplicationResponse(
                plan.getId(),
                result.roomCreations().size(),
                result.roomAssignments().size(),
                result.seatAssignments().size()
        );
    }

    @Transactional
    public AiPlanResponse discard(String planId) {
        AiPlan plan = requirePlan(planId);
        if (plan.getStatus() == AiPlanStatus.APPLIED) {
            throw conflict("Um plano aplicado nao pode ser descartado.");
        }
        plan.setStatus(AiPlanStatus.DISCARDED);
        plan = planRepository.save(plan);
        return response(plan, snapshotService.createContext(plan.getTripId()));
    }

    private void addRoomsToTrip(String tripId, List<CreatedRoom> createdRooms) {
        Trip trip = tripRepository.findById(tripId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Viagem nao encontrada.")
        );
        List<Map<String, Object>> hotels = mutableObjectList(trip.getHotelsJson());
        for (CreatedRoom created : createdRooms) {
            Map<String, Object> hotel = hotels.stream()
                    .filter(value -> created.hotelId().equals(text(value.get("id"))))
                    .findFirst()
                    .orElseThrow(() -> conflict("O hotel proposto nao esta mais configurado."));
            List<Map<String, Object>> configuredRooms = mutableObjectList(hotel.get("rooms"));
            configuredRooms.add(new LinkedHashMap<>(Map.of(
                    "id", created.room().getId(),
                    "name", created.room().getName(),
                    "type", created.room().getType(),
                    "capacity", created.room().getCapacity()
            )));
            hotel.put("rooms", configuredRooms);
        }
        try {
            trip.setHotelsJson(objectMapper.writeValueAsString(hotels));
            tripRepository.save(trip);
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel atualizar os quartos da viagem.", exception);
        }
    }

    private List<Map<String, Object>> mutableObjectList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return mutableObjectList(objectMapper.readValue(json, Object.class));
        } catch (Exception exception) {
            throw conflict("A configuracao de hoteis da viagem esta invalida.");
        }
    }

    private List<Map<String, Object>> mutableObjectList(Object value) {
        if (!(value instanceof List<?> values)) {
            return new ArrayList<>();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : values) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> copy = new LinkedHashMap<>();
                map.forEach((key, content) -> copy.put(text(key), content));
                result.add(copy);
            }
        }
        return result;
    }

    private AiPlanResponse response(AiPlan plan, TripPlanningContext context) {
        boolean current = plan.getSnapshotHash().equals(context.snapshot().snapshotHash());
        AiPlanResult result = readResultOrNull(plan);
        Map<String, String> roomLabels = new LinkedHashMap<>();
        if (current) {
            roomLabels.putAll(context.roomLabelByAlias());
        }
        if (result != null) {
            result.roomCreations().forEach(room -> roomLabels.put(room.key(), room.name()));
        }
        return new AiPlanResponse(
                plan.getId(),
                plan.getTripId(),
                plan.getStatus(),
                plan.getFocus(),
                plan.getProvider(),
                plan.getModel(),
                plan.getProviderRequestId(),
                plan.getPromptVersion(),
                plan.getSnapshotHash(),
                current,
                result,
                current ? context.travelerLabelByAlias() : Map.of(),
                current ? context.busLabelByAlias() : Map.of(),
                current ? context.hotelLabelByAlias() : Map.of(),
                Map.copyOf(roomLabels),
                plan.getInputTokens(),
                plan.getOutputTokens(),
                plan.getEstimatedCost(),
                plan.getErrorCode(),
                plan.getCreatedAt(),
                plan.getUpdatedAt(),
                plan.getAppliedAt()
        );
    }

    private void saveFailure(AiPlan plan, String errorCode) {
        plan.setStatus(AiPlanStatus.FAILED);
        plan.setErrorCode(errorCode == null || errorCode.isBlank() ? "UNKNOWN" : errorCode);
        planRepository.save(plan);
    }

    private AiPlanResult readResult(AiPlan plan) {
        AiPlanResult result = readResultOrNull(plan);
        if (result == null) {
            throw conflict("O conteudo do plano nao esta disponivel.");
        }
        return result;
    }

    private AiPlanResult readResultOrNull(AiPlan plan) {
        if (plan.getResultJson() == null || plan.getResultJson().isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(plan.getResultJson(), AiPlanResult.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    private AiPlanningFocus parseFocus(String value) {
        try {
            return AiPlanningFocus.valueOf(value == null ? "ALL" : value);
        } catch (IllegalArgumentException exception) {
            throw conflict("O foco do plano e invalido.");
        }
    }

    private AiPlan requirePlan(String planId) {
        return planRepository.findById(required(planId, "Plano")).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Plano automatico nao encontrado.")
        );
    }

    private Room copyRoom(Room source) {
        return new Room(
                source.getId(),
                source.getType(),
                source.getCapacity(),
                source.getName(),
                source.getHotelId(),
                source.getOccupants() == null
                        ? new ArrayList<>()
                        : new ArrayList<>(source.getOccupants()),
                source.getTripId()
        );
    }

    private Seat copySeat(Seat source) {
        return new Seat(
                source.getId(),
                source.getTripId(),
                source.getBusId(),
                source.getFloor(),
                source.getSeatNumber(),
                source.getUserCpf()
        );
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw badRequest(label + " e obrigatorio.");
        }
        return value.trim();
    }

    private String text(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private ResponseStatusException tooManyRequests(String message) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    private record CreatedRoom(String hotelId, Room room) {
    }
}
