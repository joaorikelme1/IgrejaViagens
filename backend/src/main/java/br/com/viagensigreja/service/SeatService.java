package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.repository.SeatRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class SeatService {

    private final SeatRepository repository;
    private final TripMembershipService membership;

    public SeatService(SeatRepository repository, TripMembershipService membership) {
        this.repository = repository;
        this.membership = membership;
    }

    @Transactional
    public Seat salvar(Seat seat) {
        if (seat == null) {
            throw badRequest("Os dados do assento sao obrigatorios.");
        }
        String id = seat.getId();
        if (id == null || id.isBlank()) {
            id = "seat_" + UUID.randomUUID();
        }
        return persistir(id, seat);
    }

    @Transactional
    public Seat atualizar(String id, Seat seat) {
        if (id == null || id.isBlank() || seat == null) {
            throw badRequest("Os dados do assento sao obrigatorios.");
        }
        if (seat.getId() != null && !seat.getId().isBlank() && !id.equals(seat.getId())) {
            throw badRequest("O ID do assento nao corresponde ao recurso informado.");
        }
        return persistir(id, seat);
    }

    public List<Seat> buscarPorTrip(String tripId) {
        return repository.findByTripId(tripId);
    }

    public List<Seat> buscarPorUsuario(String cpf) {
        return repository.findByUserCpf(cpf);
    }

    @Transactional
    public void deletar(String id, String tripId) {
        Seat seat = repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Assento nao encontrado.")
        );
        if (!seat.getTripId().equals(tripId)) {
            throw conflict("O assento nao pertence a viagem informada.");
        }
        repository.delete(seat);
    }

    @Transactional
    public List<Seat> substituirTodos(List<Seat> seats) {
        if (seats == null) {
            throw badRequest("A lista de assentos e obrigatoria.");
        }

        List<Seat> prepared = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Set<String> coordinates = new HashSet<>();
        Set<String> travelers = new HashSet<>();
        for (Seat seat : seats) {
            if (seat == null) {
                throw badRequest("A lista de assentos possui um item vazio.");
            }
            String id = seat.getId();
            if (id == null || id.isBlank()) {
                id = "seat_" + UUID.randomUUID();
            }
            Seat normalized = normalizar(id, seat);
            if (!ids.add(id)) {
                throw badRequest("A lista possui IDs de assento duplicados.");
            }
            if (!coordinates.add(coordinateKey(normalized))) {
                throw conflict("Um assento nao pode ser ocupado por mais de um viajante.");
            }
            if (!travelers.add(normalized.getTripId() + "\n" + normalized.getUserCpf())) {
                throw conflict("Um viajante nao pode ocupar mais de um assento na mesma viagem.");
            }
            prepared.add(normalized);
        }

        repository.deleteAll();
        repository.flush();
        return repository.saveAll(prepared);
    }

    @Transactional
    public List<Seat> substituirDaViagem(String tripId, List<Seat> seats) {
        String normalizedTripId = requiredText(tripId, "Viagem");
        membership.requireTrip(normalizedTripId);
        if (seats == null) {
            throw badRequest("A lista de assentos e obrigatoria.");
        }

        List<Seat> prepared = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Set<String> coordinates = new HashSet<>();
        Set<String> travelers = new HashSet<>();
        for (Seat seat : seats) {
            if (seat == null || !normalizedTripId.equals(seat.getTripId())) {
                throw badRequest("Todos os assentos devem pertencer a viagem informada.");
            }
            String id = seat.getId();
            if (id == null || id.isBlank()) {
                id = "seat_" + UUID.randomUUID();
            }
            Seat normalized = normalizar(id, seat);
            if (!ids.add(id)) {
                throw badRequest("A lista possui IDs de assento duplicados.");
            }
            if (!coordinates.add(coordinateKey(normalized))) {
                throw conflict("Um assento nao pode ser ocupado por mais de um viajante.");
            }
            if (!travelers.add(normalized.getUserCpf())) {
                throw conflict("Um viajante nao pode ocupar mais de um assento na mesma viagem.");
            }
            prepared.add(normalized);
        }

        repository.deleteByTripId(normalizedTripId);
        repository.flush();
        return repository.saveAll(prepared);
    }

    private Seat persistir(String id, Seat seat) {
        Seat existing = repository.findById(id).orElse(null);
        Seat prepared = normalizar(id, seat);
        if (existing != null && !samePosition(existing, prepared)) {
            throw conflict("Um assento existente nao pode ser movido para outra posicao.");
        }

        boolean occupied = repository.findByTripIdAndBusIdAndFloorAndSeatNumber(
                        prepared.getTripId(),
                        prepared.getBusId(),
                        prepared.getFloor(),
                        prepared.getSeatNumber()
                ).stream()
                .anyMatch(current -> !current.getId().equals(id));
        if (occupied) {
            throw conflict("Este assento ja esta ocupado.");
        }

        boolean travelerAlreadySeated = repository.findByUserCpfAndTripId(
                        prepared.getUserCpf(),
                        prepared.getTripId()
                ).stream()
                .anyMatch(current -> !current.getId().equals(id));
        if (travelerAlreadySeated) {
            throw conflict("O viajante ja possui um assento nesta viagem.");
        }
        return repository.save(prepared);
    }

    private Seat normalizar(String id, Seat seat) {
        seat.setId(id);
        seat.setTripId(requiredText(seat.getTripId(), "Viagem"));
        seat.setBusId(requiredText(seat.getBusId(), "Onibus"));
        seat.setUserCpf(membership.requireTraveler(seat.getTripId(), seat.getUserCpf()));
        if (seat.getFloor() < 1 || seat.getFloor() > 2) {
            throw badRequest("O piso do assento deve ser 1 ou 2.");
        }
        if (seat.getSeatNumber() < 1) {
            throw badRequest("O numero do assento deve ser maior que zero.");
        }
        return seat;
    }

    private boolean samePosition(Seat left, Seat right) {
        return left.getTripId().equals(right.getTripId())
                && left.getBusId().equals(right.getBusId())
                && left.getFloor() == right.getFloor()
                && left.getSeatNumber() == right.getSeatNumber();
    }

    private String coordinateKey(Seat seat) {
        return seat.getTripId() + "\n" + seat.getBusId() + "\n"
                + seat.getFloor() + "\n" + seat.getSeatNumber();
    }

    private String requiredText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw badRequest(label + " e obrigatorio.");
        }
        return value.trim();
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
