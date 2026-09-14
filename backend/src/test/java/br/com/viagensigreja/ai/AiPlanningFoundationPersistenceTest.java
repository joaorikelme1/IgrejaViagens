package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.AiPlan;
import br.com.viagensigreja.model.AiPlanStatus;
import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.TripTravelerPreference;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.AiPlanRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.TripTravelerPreferenceRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@Transactional
class AiPlanningFoundationPersistenceTest {

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TripTravelerPreferenceRepository preferenceRepository;

    @Autowired
    private AiPlanRepository aiPlanRepository;

    @Test
    void persistsVersionedPreferenceAndPlanMetadata() {
        User user = new User();
        user.setCpf("39053344705");
        user.setName("Viajante de Teste");
        user.setPassword("hash");
        user.setRole("traveler");
        user.setKids(java.util.List.of());
        user.setChildCpfs(new LinkedHashSet<>());
        userRepository.save(user);

        Trip trip = new Trip(
                "trip-ai-foundation",
                "Retiro de teste",
                "Destino",
                "Origem",
                "08:00",
                LocalDate.of(2027, 2, 1),
                1,
                100.0,
                100.0,
                "",
                "[]",
                "[]",
                "[\"39053344705\"]"
        );
        tripRepository.saveAndFlush(trip);

        TripTravelerPreference preference = new TripTravelerPreference();
        preference.setId("preference-ai-foundation");
        preference.setTripId(trip.getId());
        preference.setUserCpf(user.getCpf());
        preference.setMobilityRequirement(MobilityRequirement.PREFER_LOWER_FLOOR);
        preference.setSeatRegion(SeatRegion.FRONT);
        preference.setIncludeInAiPlanning(true);
        preferenceRepository.saveAndFlush(preference);

        AiPlan plan = new AiPlan();
        plan.setId("plan-ai-foundation");
        plan.setTripId(trip.getId());
        plan.setCreatedByCpf(user.getCpf());
        plan.setStatus(AiPlanStatus.DRAFT);
        plan.setSnapshotHash("a".repeat(64));
        aiPlanRepository.saveAndFlush(plan);

        assertNotNull(trip.getVersion());
        assertNotNull(trip.getUpdatedAt());
        assertNotNull(preference.getVersion());
        assertNotNull(preference.getUpdatedAt());
        assertNotNull(plan.getVersion());
        assertNotNull(plan.getCreatedAt());
        assertEquals(AiPlanStatus.DRAFT, aiPlanRepository.findById(plan.getId()).orElseThrow().getStatus());
    }
}
