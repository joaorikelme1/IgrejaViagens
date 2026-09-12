package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {

    List<Payment> findByUserCpf(String cpf);

    Optional<Payment> findFirstByUserCpfAndTripId(String cpf, String tripId);

    List<Payment> findByUserCpfAndTripId(String cpf, String tripId);

    void deleteByUserCpf(String cpf);

    void deleteByUserCpfAndTripId(String cpf, String tripId);

    void deleteByTripId(String tripId);

}
