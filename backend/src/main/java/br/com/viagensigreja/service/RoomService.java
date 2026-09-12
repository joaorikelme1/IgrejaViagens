package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.repository.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class RoomService {

    private final RoomRepository repository;
    private final TripMembershipService membership;

    public RoomService(RoomRepository repository, TripMembershipService membership) {
        this.repository = repository;
        this.membership = membership;
    }

    @Transactional
    public Room salvar(Room room) {
        if (room == null) {
            throw badRequest("Os dados do quarto sao obrigatorios.");
        }
        String id = room.getId();
        if (id == null || id.isBlank()) {
            id = "room_" + UUID.randomUUID();
        }
        return persistir(id, room);
    }

    @Transactional
    public Room atualizar(String id, Room room) {
        if (id == null || id.isBlank() || room == null) {
            throw badRequest("Os dados do quarto sao obrigatorios.");
        }
        if (room.getId() != null && !room.getId().isBlank() && !id.equals(room.getId())) {
            throw badRequest("O ID do quarto nao corresponde ao recurso informado.");
        }
        return persistir(id, room);
    }

    public List<Room> buscarPorTrip(String tripId) {
        return repository.findByTripId(tripId);
    }

    @Transactional
    public void deletar(String id, String tripId) {
        Room room = repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Quarto nao encontrado.")
        );
        if (!room.getTripId().equals(tripId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O quarto nao pertence a viagem informada."
            );
        }
        repository.delete(room);
    }

    @Transactional
    public List<Room> substituirTodos(List<Room> rooms) {
        if (rooms == null) {
            throw badRequest("A lista de quartos e obrigatoria.");
        }

        Set<String> ids = new HashSet<>();
        List<Room> prepared = new ArrayList<>();
        for (Room room : rooms) {
            if (room == null) {
                throw badRequest("A lista de quartos possui um item vazio.");
            }
            String id = room.getId();
            if (id == null || id.isBlank()) {
                id = "room_" + UUID.randomUUID();
            }
            if (!ids.add(id)) {
                throw badRequest("A lista possui IDs de quarto duplicados.");
            }
            prepared.add(normalizar(id, room));
        }
        validarOcupacoesUnicas(prepared);

        repository.deleteAll();
        repository.flush();
        return repository.saveAll(prepared);
    }

    private Room persistir(String id, Room room) {
        Room existing = repository.findById(id).orElse(null);
        Room prepared = normalizar(id, room);
        if (existing != null && !existing.getTripId().equals(prepared.getTripId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Um quarto existente nao pode ser movido para outra viagem."
            );
        }

        Set<String> occupants = new HashSet<>(prepared.getOccupants());
        boolean duplicateOccupant = repository.findByTripId(prepared.getTripId()).stream()
                .filter(current -> !current.getId().equals(id))
                .flatMap(current -> current.getOccupants() == null
                        ? java.util.stream.Stream.empty()
                        : current.getOccupants().stream())
                .map(membership::normalizeCpf)
                .anyMatch(occupants::contains);
        if (duplicateOccupant) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Um viajante nao pode ocupar mais de um quarto na mesma viagem."
            );
        }
        return repository.save(prepared);
    }

    private Room normalizar(String id, Room room) {
        room.setId(id);
        room.setTripId(requiredText(room.getTripId(), "Viagem"));
        room.setHotelId(requiredText(room.getHotelId(), "Hotel"));
        room.setName(requiredText(room.getName(), "Nome do quarto"));
        room.setType(requiredText(room.getType(), "Tipo do quarto"));
        if (room.getCapacity() < 1) {
            throw badRequest("A capacidade do quarto deve ser maior que zero.");
        }

        var trip = membership.requireTrip(room.getTripId());
        Set<String> tripTravelers = membership.travelerCpfs(trip);
        Set<String> occupants = new LinkedHashSet<>();
        if (room.getOccupants() != null) {
            for (String value : room.getOccupants()) {
                String cpf = membership.normalizeCpf(value);
                if (cpf.length() != 11 || !tripTravelers.contains(cpf)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Todos os ocupantes devem ser viajantes associados a viagem."
                    );
                }
                occupants.add(cpf);
            }
        }
        if (occupants.size() > room.getCapacity()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A quantidade de ocupantes excede a capacidade do quarto."
            );
        }
        room.setOccupants(new ArrayList<>(occupants));
        return room;
    }

    private void validarOcupacoesUnicas(List<Room> rooms) {
        Map<String, Set<String>> occupantsByTrip = new HashMap<>();
        for (Room room : rooms) {
            Set<String> occupied = occupantsByTrip.computeIfAbsent(
                    room.getTripId(),
                    ignored -> new HashSet<>()
            );
            for (String cpf : room.getOccupants()) {
                if (!occupied.add(cpf)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Um viajante nao pode ocupar mais de um quarto na mesma viagem."
                    );
                }
            }
        }
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
}
