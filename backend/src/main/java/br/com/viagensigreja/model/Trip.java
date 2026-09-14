package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.Instant;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Trip {

    @Id
    private String id;

    @Version
    private Long version;

    @Column(nullable = false)
    private Instant updatedAt;

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

    @PrePersist
    @PreUpdate
    private void updateTimestamp() {
        updatedAt = Instant.now();
    }

    /** Mantem compatibilidade com os criadores anteriores ao versionamento. */
    public Trip(
            String id,
            String name,
            String destination,
            String departurePlace,
            String departureTime,
            LocalDate date,
            Integer maxPeople,
            Double price,
            Double arrecadationGoal,
            String rules,
            String busesJson,
            String hotelsJson,
            String travelersJson
    ) {
        this(id, null, null, name, destination, departurePlace, departureTime, date,
                maxPeople, price, arrecadationGoal, rules, busesJson, hotelsJson, travelersJson);
    }
}
