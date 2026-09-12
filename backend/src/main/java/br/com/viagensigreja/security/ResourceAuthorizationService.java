package br.com.viagensigreja.security;

import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.repository.TripRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component("resourceAuthorizationService")
public class ResourceAuthorizationService {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_TRAVELER = "ROLE_TRAVELER";

    private final TripRepository tripRepository;
    private final ObjectMapper objectMapper;

    public ResourceAuthorizationService(TripRepository tripRepository, ObjectMapper objectMapper) {
        this.tripRepository = tripRepository;
        this.objectMapper = objectMapper;
    }

    public boolean isAdmin(Authentication authentication) {
        return hasAuthority(authentication, ROLE_ADMIN);
    }

    public boolean isTraveler(Authentication authentication) {
        return hasAuthority(authentication, ROLE_TRAVELER);
    }

    public String authenticatedCpf(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Usuario nao autenticado.");
        }

        String cpf = normalizeCpf(authentication.getName());
        if (cpf.isBlank()) {
            throw new AccessDeniedException("Identidade autenticada invalida.");
        }
        return cpf;
    }

    public void requireSelfOrAdmin(Authentication authentication, String requestedCpf) {
        if (!isAdmin(authentication)
                && !authenticatedCpf(authentication).equals(normalizeCpf(requestedCpf))) {
            throw new AccessDeniedException("O recurso pertence a outro usuario.");
        }
    }

    public void requireTripAccess(Authentication authentication, String tripId) {
        if (!isAdmin(authentication) && !canAccessTrip(authentication, tripId)) {
            throw new AccessDeniedException("A viagem nao pertence ao usuario autenticado.");
        }
    }

    public boolean canAccessTrip(Authentication authentication, String tripId) {
        if (isAdmin(authentication)) {
            return true;
        }
        if (!isTraveler(authentication) || tripId == null || tripId.isBlank()) {
            return false;
        }

        String cpf = authenticatedCpf(authentication);
        return tripRepository.findById(tripId)
                .map(trip -> containsTraveler(trip, cpf))
                .orElse(false);
    }

    public Set<String> accessibleTripIds(Authentication authentication) {
        if (isAdmin(authentication)) {
            return tripRepository.findAll().stream()
                    .map(Trip::getId)
                    .collect(Collectors.toUnmodifiableSet());
        }

        String cpf = authenticatedCpf(authentication);
        return tripRepository.findAll().stream()
                .filter(trip -> containsTraveler(trip, cpf))
                .map(Trip::getId)
                .collect(Collectors.toUnmodifiableSet());
    }

    public List<Trip> accessibleTrips(Authentication authentication) {
        if (isAdmin(authentication)) {
            return tripRepository.findAll();
        }

        String cpf = authenticatedCpf(authentication);
        return tripRepository.findAll().stream()
                .filter(trip -> containsTraveler(trip, cpf))
                .toList();
    }

    public boolean belongsTo(String storedCpf, String authenticatedCpf) {
        return !normalizeCpf(storedCpf).isBlank()
                && normalizeCpf(storedCpf).equals(normalizeCpf(authenticatedCpf));
    }

    public String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private boolean containsTraveler(Trip trip, String cpf) {
        String travelersJson = trip.getTravelersJson();
        if (travelersJson == null || travelersJson.isBlank()) {
            return false;
        }

        try {
            Object parsed = objectMapper.readValue(travelersJson, Object.class);
            if (!(parsed instanceof List<?> travelers)) {
                return false;
            }

            for (Object traveler : travelers) {
                if (traveler instanceof String travelerCpf
                        && normalizeCpf(travelerCpf).equals(cpf)) {
                    return true;
                }
            }
        } catch (Exception ignored) {
            // Fail closed: JSON legado invalido nunca concede acesso ao viajante.
        }
        return false;
    }

    private boolean hasAuthority(Authentication authentication, String authority) {
        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
