package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bus {

    @Id
    private String id;

    private int floors;
    private int seats;
    private int seatsFloor1;
    private int seatsFloor2;

    private String tripId;
}
