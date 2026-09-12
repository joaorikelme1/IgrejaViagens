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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.text.Normalizer;
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
        User created = repository.save(user);
        sincronizarConjuge(created, null);
        reconciliarConjugePorNome(created);
        return created;
    }

    @Transactional
    public User atualizar(String cpf, User novosDados) {
        String cpfLimpo = normalizeCpf(cpf);
        User usuarioExistente = repository.findById(cpfLimpo)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Usuario nao encontrado."
                ));

        String conjugeAnterior = normalizeCpf(usuarioExistente.getSpouseCpf());
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

        User updated = repository.save(novosDados);
        sincronizarConjuge(updated, conjugeAnterior);
        if (updated.isMarried()) {
            reconciliarConjugePorNome(updated);
        }
        return updated;
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
            normalizarVinculosFamiliares(user);
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

        List<User> changedRelatives = repository.findAll().stream()
                .filter(user -> !user.getCpf().equals(cpfLimpo))
                .filter(user -> removeFamilyReference(user, cpfLimpo))
                .toList();
        repository.saveAll(changedRelatives);

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
        normalizarVinculosFamiliares(user);
        User spouse = validarConjuge(user);
        validarFilhos(user);
        if (spouse != null) {
            user.setSpouseName(spouse.getName());
        }
        if (user.isMarried() && (user.getSpouseName() == null || user.getSpouseName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome do conjuge e obrigatorio.");
        }
        if (!user.isMarried()) {
            user.setSpouseName("");
            user.setSpouseCpf(null);
        }
        if (user.isHasKids() && (user.getKids() == null || user.getKids().stream()
                .anyMatch(kid -> kid == null || kid.isBlank()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome de todos os filhos.");
        }
        if (!user.isHasKids() || user.getKids() == null) {
            user.setKids(new ArrayList<>());
        }
        if (!user.isHasKids()) {
            user.setChildCpfs(new LinkedHashSet<>());
        }
    }

    private void normalizarVinculosFamiliares(User user) {
        String spouseCpf = normalizeCpf(user.getSpouseCpf());
        user.setSpouseCpf(spouseCpf.isBlank() ? null : spouseCpf);
        Set<String> childCpfs = new LinkedHashSet<>();
        if (user.getChildCpfs() != null) {
            user.getChildCpfs().stream()
                    .map(this::normalizeCpf)
                    .filter(value -> !value.isBlank())
                    .forEach(childCpfs::add);
        }
        user.setChildCpfs(childCpfs);
    }

    private User validarConjuge(User user) {
        String spouseCpf = user.getSpouseCpf();
        if (spouseCpf == null || spouseCpf.isBlank()) {
            return null;
        }
        if (spouseCpf.equals(user.getCpf())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Um usuario nao pode ser seu proprio conjuge.");
        }
        User spouse = repository.findById(spouseCpf).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "O cadastro selecionado para conjuge nao existe.")
        );
        String linkedCpf = normalizeCpf(spouse.getSpouseCpf());
        if (!linkedCpf.isBlank() && !linkedCpf.equals(user.getCpf())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O conjuge selecionado ja esta vinculado a outro cadastro."
            );
        }
        return spouse;
    }

    private void validarFilhos(User user) {
        for (String childCpf : user.getChildCpfs()) {
            if (childCpf.equals(user.getCpf())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Um usuario nao pode ser seu proprio filho.");
            }
            if (!repository.existsById(childCpf)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Um dos cadastros selecionados como filho nao existe."
                );
            }
        }
    }

    private void sincronizarConjuge(User user, String previousSpouseCpf) {
        String spouseCpf = normalizeCpf(user.getSpouseCpf());
        if (previousSpouseCpf != null
                && !previousSpouseCpf.isBlank()
                && !previousSpouseCpf.equals(spouseCpf)) {
            repository.findById(previousSpouseCpf).ifPresent(previous -> {
                if (normalizeCpf(previous.getSpouseCpf()).equals(user.getCpf())) {
                    previous.setSpouseCpf(null);
                    previous.setMarried(false);
                    previous.setSpouseName("");
                    repository.save(previous);
                }
            });
        }
        if (spouseCpf.isBlank()) {
            return;
        }
        User spouse = repository.findById(spouseCpf).orElseThrow();
        spouse.setMarried(true);
        spouse.setSpouseCpf(user.getCpf());
        spouse.setSpouseName(user.getName());
        repository.save(spouse);
    }

    private void reconciliarConjugePorNome(User user) {
        if (!normalizeCpf(user.getSpouseCpf()).isBlank()) {
            return;
        }
        String userName = normalizeName(user.getName());
        String informedSpouseName = normalizeName(user.getSpouseName());
        List<User> candidates = repository.findAll().stream()
                .filter(candidate -> !candidate.getCpf().equals(user.getCpf()))
                .filter(candidate -> normalizeCpf(candidate.getSpouseCpf()).isBlank())
                .filter(candidate ->
                        (!informedSpouseName.isBlank()
                                && normalizeName(candidate.getName()).equals(informedSpouseName))
                        || (candidate.isMarried()
                                && normalizeName(candidate.getSpouseName()).equals(userName)))
                .toList();
        if (candidates.size() != 1) {
            return;
        }
        User spouse = candidates.get(0);
        user.setMarried(true);
        user.setSpouseCpf(spouse.getCpf());
        user.setSpouseName(spouse.getName());
        spouse.setMarried(true);
        spouse.setSpouseCpf(user.getCpf());
        spouse.setSpouseName(user.getName());
        repository.save(user);
        repository.save(spouse);
    }

    private String normalizeName(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(java.util.Locale.ROOT);
    }

    private boolean removeFamilyReference(User user, String removedCpf) {
        boolean changed = false;
        if (normalizeCpf(user.getSpouseCpf()).equals(removedCpf)) {
            user.setSpouseCpf(null);
            changed = true;
        }
        if (user.getChildCpfs() != null && user.getChildCpfs().removeIf(removedCpf::equals)) {
            changed = true;
        }
        return changed;
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
