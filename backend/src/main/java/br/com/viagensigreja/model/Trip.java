package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Trip {

    @Id
    private String id;

    private String name;
    private String destination;
    private String departurePlace;
    private String departureTime;

    private LocalDate date;

    private Integer maxPeople;
    private Double price;
    private Double arrecadationGoal;

    @Column(length = 1000)
    private String rules;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String busesJson;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String hotelsJson;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String travelersJson;
}
