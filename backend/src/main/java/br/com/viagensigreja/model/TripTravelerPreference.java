package br.com.viagensigreja.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(
        name = "trip_traveler_preference",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_trip_traveler_preference",
                columnNames = {"trip_id", "user_cpf"}
        )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TripTravelerPreference {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(name = "user_cpf", nullable = false)
    private String userCpf;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MobilityRequirement mobilityRequirement = MobilityRequirement.NONE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SeatRegion seatRegion = SeatRegion.ANY;

    private Integer preferredBusFloor;

    private String preferredRoomType;

    @Column(nullable = false)
    private boolean includeInAiPlanning = true;

    @ElementCollection
    @CollectionTable(
            name = "trip_traveler_preference_companion",
            joinColumns = @JoinColumn(name = "preference_id")
    )
    @Column(name = "companion_cpf")
    private Set<String> companionCpfs = new LinkedHashSet<>();

    @ElementCollection
    @CollectionTable(
            name = "trip_traveler_preference_separation",
            joinColumns = @JoinColumn(name = "preference_id")
    )
    @Column(name = "separated_from_cpf")
    private Set<String> separatedFromCpfs = new LinkedHashSet<>();

    @Version
    private Long version;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    private void updateTimestamp() {
        updatedAt = Instant.now();
        if (mobilityRequirement == null) {
            mobilityRequirement = MobilityRequirement.NONE;
        }
        if (seatRegion == null) {
            seatRegion = SeatRegion.ANY;
        }
    }
}
