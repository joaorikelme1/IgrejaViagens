package br.com.viagensigreja.controller;

import br.com.viagensigreja.dto.TripTravelerPreferenceRequest;
import br.com.viagensigreja.dto.TripTravelerPreferenceResponse;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.service.TripTravelerPreferenceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/ai/preferences")
@PreAuthorize("hasRole('ADMIN')")
public class TripTravelerPreferenceController {

    private final TripTravelerPreferenceService service;

    public TripTravelerPreferenceController(TripTravelerPreferenceService service) {
        this.service = service;
    }

    @GetMapping
    public List<TripTravelerPreferenceResponse> list(@RequestParam String tripId) {
        return service.listByTrip(tripId).stream().map(this::response).toList();
    }

    @PutMapping("/{userCpf}")
    public TripTravelerPreferenceResponse save(
            @RequestParam String tripId,
            @PathVariable String userCpf,
            @RequestBody TripTravelerPreferenceRequest request
    ) {
        if (request == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "As preferencias do viajante sao obrigatorias."
            );
        }
        TripTravelerPreference submitted = new TripTravelerPreference();
        submitted.setMobilityRequirement(request.mobilityRequirement());
        submitted.setSeatRegion(request.seatRegion());
        submitted.setPreferredBusFloor(request.preferredBusFloor());
        submitted.setPreferredRoomType(request.preferredRoomType());
        submitted.setIncludeInAiPlanning(request.includeInAiPlanning());
        submitted.setCompanionCpfs(copy(request.companionCpfs()));
        submitted.setSeparatedFromCpfs(copy(request.separatedFromCpfs()));
        submitted.setVersion(request.version());
        return response(service.save(tripId, userCpf, submitted));
    }

    @DeleteMapping("/{userCpf}")
    public void delete(
            @RequestParam String tripId,
            @PathVariable String userCpf
    ) {
        service.delete(tripId, userCpf);
    }

    private TripTravelerPreferenceResponse response(TripTravelerPreference value) {
        return new TripTravelerPreferenceResponse(
                value.getUserCpf(),
                value.getMobilityRequirement(),
                value.getSeatRegion(),
                value.getPreferredBusFloor(),
                value.getPreferredRoomType(),
                value.isIncludeInAiPlanning(),
                Set.copyOf(value.getCompanionCpfs()),
                Set.copyOf(value.getSeparatedFromCpfs()),
                value.getVersion(),
                value.getUpdatedAt()
        );
    }

    private Set<String> copy(Set<String> values) {
        return values == null ? new LinkedHashSet<>() : new LinkedHashSet<>(values);
    }
}
