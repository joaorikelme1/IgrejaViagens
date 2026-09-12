package br.com.viagensigreja.service;

import br.com.viagensigreja.model.User;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import tools.jackson.databind.ObjectMapper;

@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final TripRepository tripRepository;
    private final PaymentRepository paymentRepository;
    private final SeatRepository seatRepository;
    private final RoomRepository roomRepository;
    private final ObjectMapper objectMapper;

    public UserService(
            UserRepository repository,
            PasswordEncoder passwordEncoder,
            TripRepository tripRepository,
            PaymentRepository paymentRepository,
            SeatRepository seatRepository,
            RoomRepository roomRepository,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.tripRepository = tripRepository;
        this.paymentRepository = paymentRepository;
        this.seatRepository = seatRepository;
        this.roomRepository = roomRepository;
        this.objectMapper = objectMapper;
    }

    public List<User> listar() {
        return repository.findAll();
    }

    @Transactional
    public User criar(User user) {
        String cpf = normalizeCpf(user.getCpf());
        if (!isValidCpf(cpf)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF invalido.");
        }
        if (repository.existsById(cpf)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ja existe um usuario cadastrado com este CPF."
            );
        }
        user.setCpf(cpf);
        validarDados(user, true);
        codificarNovaSenha(user);
        return repository.save(user);
    }

    @Transactional
    public User atualizar(String cpf, User novosDados) {
        String cpfLimpo = normalizeCpf(cpf);
        User usuarioExistente = repository.findById(cpfLimpo)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Usuario nao encontrado."
                ));

        novosDados.setCpf(cpfLimpo);
        validarDados(novosDados, false);
        if ("admin".equalsIgnoreCase(usuarioExistente.getRole())
                && !"admin".equalsIgnoreCase(novosDados.getRole())
                && repository.countByRoleIgnoreCase("admin") <= 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O ultimo administrador do sistema nao pode perder esse perfil."
            );
        }

        if (novosDados.getPassword() == null) {
            novosDados.setPassword(usuarioExistente.getPassword());
        } else {
            codificarNovaSenha(novosDados);
        }

        return repository.save(novosDados);
    }

    @Transactional
    public User concluirPrimeiroAcesso(String cpf, String novaSenha) {
        User existente = repository.findById(cpf)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Usuario nao encontrado."
                ));

        if (!existente.isFirstLogin()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "O primeiro acesso deste usuario ja foi concluido."
            );
        }
        if (novaSenha == null || novaSenha.length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A nova senha deve ter ao menos 8 caracteres."
            );
        }

        existente.setPassword(passwordEncoder.encode(novaSenha));
        existente.setFirstLogin(false);
        return repository.save(existente);
    }

    @Transactional
    public List<User> substituirTodos(List<User> users) {
        Map<String, String> senhasExistentes = new HashMap<>();
        repository.findAll().forEach(user ->
                senhasExistentes.put(user.getCpf(), user.getPassword())
        );

        users.forEach(user -> {
            user.setCpf(user.getCpf().replaceAll("\\D", ""));
            if (user.getPassword() == null) {
                user.setPassword(senhasExistentes.get(user.getCpf()));
            } else {
                codificarNovaSenha(user);
            }
        });

        repository.deleteAll();
        return repository.saveAll(users);
    }

    public User buscarPorCpf(String cpf) {
        return repository.findById(cpf).orElse(null);
    }

    @Transactional
    public void deletar(String cpf) {
        String cpfLimpo = normalizeCpf(cpf);
        User existing = repository.findById(cpfLimpo).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario nao encontrado.")
        );
        if ("admin".equalsIgnoreCase(existing.getRole())
                && repository.countByRoleIgnoreCase("admin") <= 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O ultimo administrador do sistema nao pode ser excluido."
            );
        }

        List<Trip> changedTrips = tripRepository.findAll().stream()
                .filter(trip -> removeTravelerFromTrip(trip, cpfLimpo))
                .toList();
        tripRepository.saveAll(changedTrips);

        List<Room> changedRooms = roomRepository.findAll().stream()
                .filter(room -> removeOccupant(room, cpfLimpo))
                .toList();
        roomRepository.saveAll(changedRooms);

        paymentRepository.deleteByUserCpf(cpfLimpo);
        seatRepository.deleteByUserCpf(cpfLimpo);
        repository.delete(existing);
    }

    private void codificarNovaSenha(User user) {
        if (user.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
    }

    private void validarDados(User user, boolean passwordRequired) {
        if (user.getName() == null || user.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome e obrigatorio.");
        }
        if (!"admin".equalsIgnoreCase(user.getRole())
                && !"traveler".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Perfil de usuario invalido.");
        }
        if ((passwordRequired || user.getPassword() != null)
                && (user.getPassword() == null || user.getPassword().length() < 8)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A senha inicial deve ter ao menos 8 caracteres."
            );
        }
        if (user.isMarried() && (user.getSpouseName() == null || user.getSpouseName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome do conjuge e obrigatorio.");
        }
        if (!user.isMarried()) {
            user.setSpouseName("");
        }
        if (user.isHasKids() && (user.getKids() == null || user.getKids().stream()
                .anyMatch(kid -> kid == null || kid.isBlank()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome de todos os filhos.");
        }
        if (!user.isHasKids() || user.getKids() == null) {
            user.setKids(new ArrayList<>());
        }
    }

    private String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private boolean isValidCpf(String cpf) {
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) {
            return false;
        }
        return cpfDigit(cpf, 9) == Character.digit(cpf.charAt(9), 10)
                && cpfDigit(cpf, 10) == Character.digit(cpf.charAt(10), 10);
    }

    private int cpfDigit(String cpf, int length) {
        int sum = 0;
        for (int index = 0; index < length; index++) {
            sum += Character.digit(cpf.charAt(index), 10) * (length + 1 - index);
        }
        int remainder = (sum * 10) % 11;
        return remainder == 10 ? 0 : remainder;
    }

    private boolean removeTravelerFromTrip(Trip trip, String cpf) {
        String json = trip.getTravelersJson();
        if (json == null || json.isBlank()) {
            return false;
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?> values)) {
                return false;
            }
            List<Object> filtered = values.stream()
                    .filter(value -> !(value instanceof String travelerCpf)
                            || !normalizeCpf(travelerCpf).equals(cpf))
                    .map(value -> (Object) value)
                    .toList();
            if (filtered.size() == values.size()) {
                return false;
            }
            trip.setTravelersJson(objectMapper.writeValueAsString(filtered));
            return true;
        } catch (Exception ignored) {
            // JSON legado invalido nao concede acesso e tambem nao impede a
            // limpeza dos demais dados relacionais do usuario.
            return false;
        }
    }

    private boolean removeOccupant(Room room, String cpf) {
        if (room.getOccupants() == null) {
            return false;
        }
        List<String> filtered = room.getOccupants().stream()
                .filter(Objects::nonNull)
                .filter(occupant -> !normalizeCpf(occupant).equals(cpf))
                .toList();
        if (filtered.size() == room.getOccupants().size()) {
            return false;
        }
        room.setOccupants(new ArrayList<>(filtered));
        return true;
    }
}
