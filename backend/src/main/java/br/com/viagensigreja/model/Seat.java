package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_seat_trip_position",
                        columnNames = {"trip_id", "bus_id", "floor", "seat_number"}
                ),
                @UniqueConstraint(
                        name = "uk_seat_trip_traveler",
                        columnNames = {"trip_id", "user_cpf"}
                )
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Seat {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(name = "bus_id", nullable = false)
    private String busId;

    private int floor;
    @Column(name = "seat_number", nullable = false)
    private int seatNumber;

    @Column(name = "user_cpf", nullable = false)
    private String userCpf;
}
