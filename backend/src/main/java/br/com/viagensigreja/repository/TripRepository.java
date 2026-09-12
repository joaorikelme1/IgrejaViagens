package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.Trip;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, String> {
}