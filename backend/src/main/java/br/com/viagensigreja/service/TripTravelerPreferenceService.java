package br.com.viagensigreja.service;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.repository.TripTravelerPreferenceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class TripTravelerPreferenceService {

    private final TripTravelerPreferenceRepository repository;
    private final TripMembershipService membership;

    public TripTravelerPreferenceService(
            TripTravelerPreferenceRepository repository,
            TripMembershipService membership
    ) {
        this.repository = repository;
        this.membership = membership;
    }

    @Transactional(readOnly = true)
    public List<TripTravelerPreference> listByTrip(String tripId) {
        membership.requireTrip(tripId);
        return repository.findByTripIdOrderByUserCpfAsc(tripId);
    }

    @Transactional
    public TripTravelerPreference save(
            String tripId,
            String userCpfValue,
            TripTravelerPreference submitted
    ) {
        if (submitted == null) {
            throw badRequest("As preferencias do viajante sao obrigatorias.");
        }
        Trip trip = membership.requireTrip(tripId);
        String userCpf = membership.normalizeCpf(userCpfValue);
        Set<String> tripTravelers = membership.travelerCpfs(trip);
        if (!tripTravelers.contains(userCpf)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "As preferencias so podem ser registradas para um viajante da viagem."
            );
        }

        TripTravelerPreference target = repository.findByTripIdAndUserCpf(tripId, userCpf)
                .orElseGet(TripTravelerPreference::new);
        if (target.getId() == null) {
            target.setId("preference_" + UUID.randomUUID());
        } else if (submitted.getVersion() != null
                && !submitted.getVersion().equals(target.getVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "As preferencias foram alteradas por outro usuario."
            );
        }

        target.setTripId(tripId);
        target.setUserCpf(userCpf);
        target.setMobilityRequirement(submitted.getMobilityRequirement() == null
                ? MobilityRequirement.NONE
                : submitted.getMobilityRequirement());
        target.setSeatRegion(submitted.getSeatRegion() == null
                ? SeatRegion.ANY
                : submitted.getSeatRegion());
        if (submitted.getPreferredBusFloor() != null && submitted.getPreferredBusFloor() < 1) {
            throw badRequest("O piso preferido deve ser maior que zero.");
        }
        target.setPreferredBusFloor(submitted.getPreferredBusFloor());
        target.setPreferredRoomType(normalizeRoomType(submitted.getPreferredRoomType()));
        target.setIncludeInAiPlanning(submitted.isIncludeInAiPlanning());

        Set<String> companions = normalizeRelatedCpfs(
                submitted.getCompanionCpfs(),
                userCpf,
                tripTravelers
        );
        Set<String> separated = normalizeRelatedCpfs(
                submitted.getSeparatedFromCpfs(),
                userCpf,
                tripTravelers
        );
        if (companions.stream().anyMatch(separated::contains)) {
            throw badRequest("Um viajante nao pode estar nas listas de companhia e separacao ao mesmo tempo.");
        }
        target.setCompanionCpfs(companions);
        target.setSeparatedFromCpfs(separated);
        return repository.save(target);
    }

    @Transactional
    public void delete(String tripId, String userCpfValue) {
        membership.requireTrip(tripId);
        String userCpf = membership.normalizeCpf(userCpfValue);
        repository.findByTripIdAndUserCpf(tripId, userCpf).ifPresent(repository::delete);
    }

    private Set<String> normalizeRelatedCpfs(
            Set<String> values,
            String ownerCpf,
            Set<String> tripTravelers
    ) {
        Set<String> result = new LinkedHashSet<>();
        if (values == null) {
            return result;
        }
        for (String value : values) {
            String cpf = membership.normalizeCpf(value);
            if (cpf.length() != 11 || !tripTravelers.contains(cpf)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Todas as preferencias de companhia devem apontar para viajantes da mesma viagem."
                );
            }
            if (cpf.equals(ownerCpf)) {
                throw badRequest("O viajante nao pode referenciar a si mesmo nas preferencias.");
            }
            result.add(cpf);
        }
        return result;
    }

    private String normalizeRoomType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > 100) {
            throw badRequest("O tipo de quarto preferido deve ter no maximo 100 caracteres.");
        }
        return normalized;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
