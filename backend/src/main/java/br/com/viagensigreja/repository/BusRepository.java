package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.Bus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BusRepository extends JpaRepository<Bus, String> {

    List<Bus> findByTripId(String tripId);

    void deleteByTripId(String tripId);

}
