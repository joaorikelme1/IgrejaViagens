package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.BusRepository;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TripServiceTest {

    @Test
    void associaAdministradorComoParticipanteECriaPagamentoInicial() {
        TripRepository tripRepository = mock(TripRepository.class);
        PaymentRepository paymentRepository = mock(PaymentRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        Trip trip = new Trip(
                "trip-1",
                "Retiro",
                "Goiânia",
                "Brasília",
                "08:00",
                LocalDate.of(2027, 1, 20),
                5,
                800.0,
                4000.0,
                "",
                "[]",
                "[]",
                "[]"
        );
        User admin = new User();
        admin.setCpf("52998224725");
        admin.setName("Ana Administradora");
        admin.setRole("admin");

        when(tripRepository.findById(trip.getId())).thenReturn(Optional.of(trip));
        when(userRepository.findById(admin.getCpf())).thenReturn(Optional.of(admin));
        when(paymentRepository.findFirstByUserCpfAndTripId(admin.getCpf(), trip.getId()))
                .thenReturn(Optional.empty());
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripService service = new TripService(
                tripRepository,
                paymentRepository,
                mock(SeatRepository.class),
                mock(RoomRepository.class),
                mock(BusRepository.class),
                userRepository,
                mock(UserService.class),
                new ObjectMapper()
        );

        Trip saved = service.adicionarViajante(trip.getId(), admin.getCpf());

        assertEquals("[\"52998224725\"]", saved.getTravelersJson());
        assertEquals("admin", admin.getRole());
        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(paymentCaptor.capture());
        assertEquals(admin.getCpf(), paymentCaptor.getValue().getUserCpf());
        assertEquals(trip.getId(), paymentCaptor.getValue().getTripId());
        assertEquals(1, paymentCaptor.getValue().getTotalInstallments());
    }

    @Test
    void rejectsUpdateBasedOnStaleTripVersion() {
        TripRepository tripRepository = mock(TripRepository.class);
        Trip existing = validTrip();
        existing.setVersion(4L);
        Trip submitted = validTrip();
        submitted.setVersion(3L);
        when(tripRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        TripService service = new TripService(
                tripRepository,
                mock(PaymentRepository.class),
                mock(SeatRepository.class),
                mock(RoomRepository.class),
                mock(BusRepository.class),
                mock(UserRepository.class),
                mock(UserService.class),
                new ObjectMapper()
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.atualizar(existing.getId(), submitted)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    private Trip validTrip() {
        return new Trip(
                "trip-versioned",
                "Retiro",
                "Goiânia",
                "Brasília",
                "08:00",
                LocalDate.of(2027, 1, 20),
                5,
                800.0,
                4000.0,
                "",
                "[]",
                "[]",
                "[]"
        );
    }
}
