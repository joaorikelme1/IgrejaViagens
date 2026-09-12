package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.Seat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, String> {

    List<Seat> findByTripId(String tripId);

    List<Seat> findByUserCpf(String cpf);

    List<Seat> findByUserCpfAndTripId(String cpf, String tripId);

    List<Seat> findByTripIdAndBusIdAndFloorAndSeatNumber(
            String tripId,
            String busId,
            int floor,
            int seatNumber
    );

    void deleteByUserCpf(String cpf);

    void deleteByUserCpfAndTripId(String cpf, String tripId);

    void deleteByTripId(String tripId);

}
