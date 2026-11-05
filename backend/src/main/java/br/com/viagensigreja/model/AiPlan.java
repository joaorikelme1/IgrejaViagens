package br.com.viagensigreja.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "ai_plan")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiPlan {

    @Id
    private String id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    private String createdByCpf;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AiPlanStatus status;

    private String provider;
    private String model;
    private String promptVersion;

    @Column(nullable = false, length = 64)
    private String snapshotHash;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String resultJson;

    private Long inputTokens;
    private Long outputTokens;
    @Column(precision = 18, scale = 8)
    private BigDecimal estimatedCost;
    private String errorCode;

    @Version
    private Long version;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant appliedAt;

    @PrePersist
    private void initializeTimestamps() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        if (status == null) {
            status = AiPlanStatus.DRAFT;
        }
    }

    @PreUpdate
    private void updateTimestamp() {
        updatedAt = Instant.now();
    }
}
