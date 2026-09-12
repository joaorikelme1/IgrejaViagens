package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class TripMembershipService {

    private final TripRepository tripRepository;
    private final ObjectMapper objectMapper;

    public TripMembershipService(TripRepository tripRepository, ObjectMapper objectMapper) {
        this.tripRepository = tripRepository;
        this.objectMapper = objectMapper;
    }

    public Trip requireTrip(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A viagem e obrigatoria.");
        }
        return tripRepository.findById(tripId.trim()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Viagem nao encontrada.")
        );
    }

    public String requireTraveler(String tripId, String cpfValue) {
        String cpf = normalizeCpf(cpfValue);
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF do viajante invalido.");
        }
        if (!travelerCpfs(requireTrip(tripId)).contains(cpf)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O viajante nao esta associado a esta viagem."
            );
        }
        return cpf;
    }

    public Set<String> travelerCpfs(Trip trip) {
        String json = trip.getTravelersJson();
        if (json == null || json.isBlank()) {
            return Set.of();
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof List<?> values)) {
                throw new IllegalArgumentException();
            }
            Set<String> result = new LinkedHashSet<>();
            for (Object value : values) {
                if (!(value instanceof String cpfValue)) {
                    throw new IllegalArgumentException();
                }
                String cpf = normalizeCpf(cpfValue);
                if (cpf.length() != 11) {
                    throw new IllegalArgumentException();
                }
                result.add(cpf);
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

    public String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }
}
