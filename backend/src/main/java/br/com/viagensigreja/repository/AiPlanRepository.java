package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.AiPlan;
import br.com.viagensigreja.model.AiPlanStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AiPlanRepository extends JpaRepository<AiPlan, String> {

    List<AiPlan> findByTripIdOrderByCreatedAtDesc(String tripId);

    List<AiPlan> findByTripIdAndStatusOrderByCreatedAtDesc(
            String tripId,
            AiPlanStatus status
    );

    Optional<AiPlan> findFirstByCreatedByCpfOrderByCreatedAtDesc(String createdByCpf);

    long countByCreatedByCpfAndCreatedAtAfter(String createdByCpf, Instant createdAfter);

    long countByTripIdAndCreatedAtAfter(String tripId, Instant createdAfter);

    long countByTripIdAndStatusIn(String tripId, List<AiPlanStatus> statuses);
}
