package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        uniqueConstraints = @UniqueConstraint(
                name = "uk_payment_user_trip",
                columnNames = {"user_cpf", "trip_id"}
        )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    private String id;

    @Column(name = "user_cpf", nullable = false)
    private String userCpf;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    private int totalInstallments;
    private int paidInstallments;

    private int dueDay;

    private boolean locked;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String receiptsJson;
}
