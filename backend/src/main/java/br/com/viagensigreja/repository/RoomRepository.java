package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.Room;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, String> {

    @Override
    @EntityGraph(attributePaths = "occupants")
    List<Room> findAll();

    @EntityGraph(attributePaths = "occupants")
    List<Room> findByTripId(String tripId);

    @Override
    @EntityGraph(attributePaths = "occupants")
    Optional<Room> findById(String id);

    void deleteByTripId(String tripId);

}
