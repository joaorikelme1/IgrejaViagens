package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.TripTravelerPreference;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TripTravelerPreferenceRepository
        extends JpaRepository<TripTravelerPreference, String> {

    @EntityGraph(attributePaths = {"companionCpfs", "separatedFromCpfs"})
    List<TripTravelerPreference> findByTripIdOrderByUserCpfAsc(String tripId);

    @EntityGraph(attributePaths = {"companionCpfs", "separatedFromCpfs"})
    Optional<TripTravelerPreference> findByTripIdAndUserCpf(String tripId, String userCpf);

    void deleteByTripId(String tripId);
}
