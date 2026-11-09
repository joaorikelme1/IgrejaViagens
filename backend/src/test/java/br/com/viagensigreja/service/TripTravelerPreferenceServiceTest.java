package br.com.viagensigreja.service;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.repository.TripTravelerPreferenceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TripTravelerPreferenceServiceTest {

    private static final String OWNER = "52998224725";
    private static final String COMPANION = "11144477735";

    @Test
    void savesStructuredPreferenceForTravelerInSameTrip() {
        TripTravelerPreferenceRepository repository = mock(TripTravelerPreferenceRepository.class);
        TripMembershipService membership = membership();
        when(repository.findByTripIdAndUserCpf("trip-1", OWNER)).thenReturn(Optional.empty());
        when(repository.save(any(TripTravelerPreference.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        TripTravelerPreference submitted = new TripTravelerPreference();
        submitted.setMobilityRequirement(MobilityRequirement.REQUIRE_LOWER_FLOOR);
        submitted.setSeatRegion(SeatRegion.FRONT);
        submitted.setPreferredBusFloor(1);
        submitted.setPreferredRoomType("  Acessivel  ");
        submitted.setIncludeInAiPlanning(true);
        submitted.setCompanionCpfs(new LinkedHashSet<>(Set.of(COMPANION)));

        TripTravelerPreference saved = new TripTravelerPreferenceService(repository, membership)
                .save("trip-1", OWNER, submitted);

        assertEquals(OWNER, saved.getUserCpf());
        assertEquals("Acessivel", saved.getPreferredRoomType());
        assertEquals(Set.of(COMPANION), saved.getCompanionCpfs());
        assertEquals(MobilityRequirement.REQUIRE_LOWER_FLOOR, saved.getMobilityRequirement());
    }

    @Test
    void rejectsSameTravelerAsCompanionAndSeparation() {
        TripTravelerPreference submitted = new TripTravelerPreference();
        submitted.setIncludeInAiPlanning(true);
        submitted.setCompanionCpfs(new LinkedHashSet<>(Set.of(COMPANION)));
        submitted.setSeparatedFromCpfs(new LinkedHashSet<>(Set.of(COMPANION)));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new TripTravelerPreferenceService(
                        mock(TripTravelerPreferenceRepository.class),
                        membership()
                ).save("trip-1", OWNER, submitted)
        );
        assertEquals(400, exception.getStatusCode().value());
    }

    private TripMembershipService membership() {
        TripMembershipService membership = mock(TripMembershipService.class);
        Trip trip = new Trip();
        trip.setId("trip-1");
        when(membership.requireTrip("trip-1")).thenReturn(trip);
        when(membership.normalizeCpf(OWNER)).thenReturn(OWNER);
        when(membership.normalizeCpf(COMPANION)).thenReturn(COMPANION);
        when(membership.travelerCpfs(trip)).thenReturn(Set.of(OWNER, COMPANION));
        return membership;
    }
}
