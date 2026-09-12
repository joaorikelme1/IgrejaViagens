package br.com.viagensigreja.service;

import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import br.com.viagensigreja.security.LegacyCompatiblePasswordEncoder;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import tools.jackson.databind.ObjectMapper;

class UserServiceTest {

    private final PasswordEncoder passwordEncoder = new LegacyCompatiblePasswordEncoder();

    @Test
    void atualizarSemPasswordPreservaSenhaExistente() {
        UserRepository repository = mock(UserRepository.class);
        UserService service = service(repository);
        String hashExistente = passwordEncoder.encode("senha-existente");
        User existente = usuario(hashExistente, "Nome antigo");
        User atualizacao = usuario(null, "Nome atualizado");

        when(repository.findById("52998224725")).thenReturn(Optional.of(existente));
        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User salvo = service.atualizar("52998224725", atualizacao);

        assertEquals(hashExistente, salvo.getPassword());
        assertEquals("Nome atualizado", salvo.getName());
        verify(repository).save(atualizacao);
    }

    @Test
    void atualizarComNovaSenhaArmazenaHash() {
        UserRepository repository = mock(UserRepository.class);
        UserService service = service(repository);
        User existente = usuario("senha-existente", "Nome antigo");
        User atualizacao = usuario("nova-senha", "Nome atualizado");

        when(repository.findById("52998224725")).thenReturn(Optional.of(existente));
        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User salvo = service.atualizar("52998224725", atualizacao);

        assertNotEquals("nova-senha", salvo.getPassword());
        assertTrue(passwordEncoder.matches("nova-senha", salvo.getPassword()));
    }

    @Test
    void criarUsuarioArmazenaSenhaComHash() {
        UserRepository repository = mock(UserRepository.class);
        UserService service = service(repository);
        User novoUsuario = usuario("senha-inicial", "Novo usuário");

        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User salvo = service.criar(novoUsuario);

        assertNotEquals("senha-inicial", salvo.getPassword());
        assertTrue(passwordEncoder.matches("senha-inicial", salvo.getPassword()));
    }

    private User usuario(String password, String name) {
        return new User(
                "52998224725",
                name,
                password,
                "traveler",
                "1990-05-12",
                false,
                false,
                null,
                false,
                List.of()
        );
    }

    private UserService service(UserRepository repository) {
        return new UserService(
                repository,
                passwordEncoder,
                mock(TripRepository.class),
                mock(PaymentRepository.class),
                mock(SeatRepository.class),
                mock(RoomRepository.class),
                new ObjectMapper()
        );
    }
}
