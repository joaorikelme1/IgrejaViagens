package br.com.viagensigreja.service;

import br.com.viagensigreja.dto.LoginDTO;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.UserRepository;
import br.com.viagensigreja.security.DatabaseUserDetailsService;
import br.com.viagensigreja.security.LegacyCompatiblePasswordEncoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private UserRepository repository;
    private PasswordEncoder passwordEncoder;
    private AuthService service;

    @BeforeEach
    void setUp() {
        repository = mock(UserRepository.class);
        passwordEncoder = new LegacyCompatiblePasswordEncoder();
        DatabaseUserDetailsService userDetailsService = new DatabaseUserDetailsService(repository);
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        AuthenticationManager authenticationManager = new ProviderManager(provider);
        service = new AuthService(repository, authenticationManager);
    }

    @Test
    void senhaLegadaAutenticaSemRehashAutomatico() {
        User user = usuarioComSenha("senha-legada");
        when(repository.findById("52998224725")).thenReturn(Optional.of(user));

        Authentication autenticacao = service.authenticate(login("529.982.247-25", "senha-legada"));

        assertTrue(autenticacao.isAuthenticated());
        assertEquals("52998224725", autenticacao.getName());
        verify(repository, never()).save(any(User.class));
    }

    @Test
    void senhaBCryptAutentica() {
        User user = usuarioComSenha(passwordEncoder.encode("senha-segura"));
        when(repository.findById("52998224725")).thenReturn(Optional.of(user));

        Authentication autenticacao = service.authenticate(login("52998224725", "senha-segura"));

        assertTrue(autenticacao.isAuthenticated());
        assertEquals("52998224725", autenticacao.getName());
    }

    @Test
    void senhaInvalidaFalha() {
        User user = usuarioComSenha(passwordEncoder.encode("senha-correta"));
        when(repository.findById("52998224725")).thenReturn(Optional.of(user));

        assertThrows(
                BadCredentialsException.class,
                () -> service.authenticate(login("52998224725", "senha-incorreta"))
        );
    }

    private LoginDTO login(String cpf, String password) {
        LoginDTO dto = new LoginDTO();
        dto.setCpf(cpf);
        dto.setPassword(password);
        return dto;
    }

    private User usuarioComSenha(String password) {
        return new User(
                "52998224725",
                "Maria",
                password,
                "traveler",
                "1990-05-12",
                false,
                false,
                "",
                false,
                List.of()
        );
    }
}
