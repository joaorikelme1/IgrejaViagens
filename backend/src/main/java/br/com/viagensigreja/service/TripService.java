package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.BusRepository;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;

@Service
public class TripService {

    private final TripRepository repository;
    private final PaymentRepository paymentRepository;
    private final SeatRepository seatRepository;
    private final RoomRepository roomRepository;
    private final BusRepository busRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    public TripService(
            TripRepository repository,
            PaymentRepository paymentRepository,
            SeatRepository seatRepository,
            RoomRepository roomRepository,
            BusRepository busRepository,
            UserRepository userRepository,
            UserService userService,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.paymentRepository = paymentRepository;
        this.seatRepository = seatRepository;
        this.roomRepository = roomRepository;
        this.busRepository = busRepository;
        this.userRepository = userRepository;
        this.userService = userService;
        this.objectMapper = objectMapper;
    }

    public List<Trip> listar() {
        return repository.findAll();
    }

    public Trip buscar(String id) {
        return repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Viagem nao encontrada.")
        );
    }

    public Optional<Trip> buscarOptional(String id) {
        return repository.findById(id);
    }

    @Transactional
    public Trip salvar(Trip trip) {
        if (trip == null) {
            throw badRequest("Os dados da viagem sao obrigatorios.");
        }
        if (trip.getId() == null || trip.getId().isBlank()) {
            trip.setId("trip_" + UUID.randomUUID());
        } else if (repository.existsById(trip.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ja existe uma viagem com este ID."
            );
        }
        trip.setTravelersJson("[]");
        validarViagem(trip);
        return repository.save(trip);
    }

    @Transactional
    public Trip atualizar(String id, Trip trip) {
        if (trip == null) {
            throw badRequest("Os dados da viagem sao obrigatorios.");
        }
        Trip existing = buscar(id);
        trip.setId(id);
        // Associações são alteradas somente pelos endpoints transacionais de
        // viajantes, que também mantêm pagamentos, quartos e assentos coerentes.
        trip.setTravelersJson(existing.getTravelersJson());
        validarViagem(trip);
        return repository.save(trip);
    }

    @Transactional
    public List<Trip> substituirTodos(List<Trip> trips) {
        Set<String> retainedIds = new HashSet<>();
        trips.forEach(trip -> {
            if (trip == null) {
                throw badRequest("A lista de viagens possui um item vazio.");
            }
            if (trip.getId() == null || trip.getId().isBlank()) {
                trip.setId("trip_" + UUID.randomUUID());
            }
            validarViagem(trip);
            if (!retainedIds.add(trip.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "A lista contem IDs de viagem duplicados."
                );
            }
        });

        repository.findAll().stream()
                .map(Trip::getId)
                .filter(id -> !retainedIds.contains(id))
                .forEach(this::deleteDependentResources);

        repository.deleteAll();
        return repository.saveAll(trips);
    }

    @Transactional
    public void deletar(String id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Viagem nao encontrada.");
        }
        deleteDependentResources(id);
        repository.deleteById(id);
    }

    @Transactional
    public Trip adicionarViajante(String tripId, String cpfValue) {
        Trip trip = buscar(tripId);
        String cpf = normalizeCpf(cpfValue);
        User user = userRepository.findById(cpf).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario nao encontrado.")
        );
        if (!"traveler".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Somente usuarios com perfil de viajante podem ser associados."
            );
        }

        List<String> travelers = parseTravelerCpfs(trip);
        if (!travelers.contains(cpf)) {
            int maxPeople = trip.getMaxPeople() == null ? 0 : trip.getMaxPeople();
            if (maxPeople < 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A viagem possui limite de pessoas invalido."
                );
            }
            if (travelers.size() >= maxPeople) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A viagem atingiu o limite de pessoas."
                );
            }
            travelers.add(cpf);
            trip.setTravelersJson(writeTravelerCpfs(travelers));
            repository.save(trip);
        }

        if (paymentRepository.findFirstByUserCpfAndTripId(cpf, tripId).isEmpty()) {
            paymentRepository.save(new Payment(
                    cpf + "_" + tripId,
                    cpf,
                    tripId,
                    1,
                    0,
                    10,
                    false,
                    "{}"
            ));
        }
        return trip;
    }

    @Transactional
    public User criarViajante(String tripId, User user) {
        Trip trip = buscar(tripId);
        List<String> travelers = parseTravelerCpfs(trip);
        int maxPeople = trip.getMaxPeople() == null ? 0 : trip.getMaxPeople();
        if (maxPeople < 1 || travelers.size() >= maxPeople) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A viagem atingiu o limite de pessoas.");
        }

        user.setRole("traveler");
        user.setFirstLogin(true);
        User created = userService.criar(user);
        adicionarViajante(tripId, created.getCpf());
        return created;
    }

    @Transactional
    public Trip removerViajante(String tripId, String cpfValue) {
        Trip trip = buscar(tripId);
        String cpf = normalizeCpf(cpfValue);
        List<String> travelers = parseTravelerCpfs(trip);
        if (!travelers.removeIf(item -> item.equals(cpf))) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Viajante nao esta associado a esta viagem."
            );
        }
        trip.setTravelersJson(writeTravelerCpfs(travelers));
        repository.save(trip);

        paymentRepository.deleteByUserCpfAndTripId(cpf, tripId);
        seatRepository.deleteByUserCpfAndTripId(cpf, tripId);
        List<Room> changedRooms = roomRepository.findByTripId(tripId).stream()
                .filter(room -> removeOccupant(room, cpf))
                .toList();
        roomRepository.saveAll(changedRooms);
        return trip;
    }

    private void deleteDependentResources(String tripId) {
        paymentRepository.deleteByTripId(tripId);
        seatRepository.deleteByTripId(tripId);
        roomRepository.deleteByTripId(tripId);
        busRepository.deleteByTripId(tripId);
    }

    private String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private List<String> parseTravelerCpfs(Trip trip) {
        String json = trip.getTravelersJson();
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?> values)) {
                throw new IllegalArgumentException();
            }
            List<String> result = new ArrayList<>();
            for (Object value : values) {
                if (!(value instanceof String cpf)) {
                    throw new IllegalArgumentException();
                }
                String normalized = normalizeCpf(cpf);
                if (normalized.length() != 11) {
                    throw new IllegalArgumentException();
                }
                if (!result.contains(normalized)) {
                    result.add(normalized);
                }
            }
            return result;
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A lista de viajantes da viagem esta invalida.",
                    exception
            );
        }
    }

    private String writeTravelerCpfs(List<String> travelers) {
        try {
            return objectMapper.writeValueAsString(travelers);
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel salvar a lista de viajantes.", exception);
        }
    }

    private boolean removeOccupant(Room room, String cpf) {
        if (room.getOccupants() == null) {
            return false;
        }
        List<String> filtered = room.getOccupants().stream()
                .filter(value -> !normalizeCpf(value).equals(cpf))
                .toList();
        if (filtered.size() == room.getOccupants().size()) {
            return false;
        }
        room.setOccupants(new ArrayList<>(filtered));
        return true;
    }

    private void validarViagem(Trip trip) {
        if (trip == null) {
            throw badRequest("Os dados da viagem sao obrigatorios.");
        }
        trip.setName(requiredText(trip.getName(), "Nome da viagem"));
        trip.setDeparturePlace(requiredText(trip.getDeparturePlace(), "Local de partida"));
        trip.setDestination(requiredText(trip.getDestination(), "Destino"));
        if (trip.getDate() == null) {
            throw badRequest("A data da viagem e obrigatoria.");
        }
        try {
            LocalTime.parse(requiredText(trip.getDepartureTime(), "Horario de partida"));
        } catch (DateTimeParseException exception) {
            throw badRequest("O horario de partida e invalido.");
        }
        if (trip.getMaxPeople() == null || trip.getMaxPeople() < 1) {
            throw badRequest("O limite de pessoas deve ser maior que zero.");
        }
        if (trip.getPrice() == null || !Double.isFinite(trip.getPrice()) || trip.getPrice() < 0) {
            throw badRequest("O preco da viagem deve ser um numero nao negativo.");
        }
        if (trip.getArrecadationGoal() == null
                || !Double.isFinite(trip.getArrecadationGoal())
                || trip.getArrecadationGoal() < 0) {
            throw badRequest("A meta de arrecadacao deve ser um numero nao negativo.");
        }
        if (trip.getRules() != null && trip.getRules().length() > 1000) {
            throw badRequest("As regras devem ter no maximo 1000 caracteres.");
        }

        trip.setBusesJson(normalizeJsonArray(trip.getBusesJson(), "onibus"));
        trip.setHotelsJson(normalizeJsonArray(trip.getHotelsJson(), "hoteis"));
        List<String> travelers = parseTravelerCpfs(trip);
        if (travelers.size() > trip.getMaxPeople()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O limite de pessoas nao pode ser menor que o numero de viajantes."
            );
        }
        trip.setTravelersJson(writeTravelerCpfs(travelers));
    }

    private String requiredText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw badRequest(label + " e obrigatorio.");
        }
        return value.trim();
    }

    private String normalizeJsonArray(String json, String label) {
        if (json == null || json.isBlank()) {
            return "[]";
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?>)) {
                throw new IllegalArgumentException();
            }
            return objectMapper.writeValueAsString(parsed);
        } catch (Exception exception) {
            throw badRequest("A configuracao de " + label + " esta invalida.");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
