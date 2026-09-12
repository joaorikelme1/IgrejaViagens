package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Room {

    @Id
    private String id;

    private String type;
    private int capacity;
    private String name;
    private String hotelId;

    @ElementCollection
    private List<String> occupants;

    private String tripId;
}
