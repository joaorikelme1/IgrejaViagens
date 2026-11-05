package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.AiPlan;
import br.com.viagensigreja.model.AiPlanStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiPlanRepository extends JpaRepository<AiPlan, String> {

    List<AiPlan> findByTripIdOrderByCreatedAtDesc(String tripId);

    List<AiPlan> findByTripIdAndStatusOrderByCreatedAtDesc(
            String tripId,
            AiPlanStatus status
    );
}
