package br.com.viagensigreja.service;

import br.com.viagensigreja.dto.LoginDTO;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository repository;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository repository, AuthenticationManager authenticationManager) {
        this.repository = repository;
        this.authenticationManager = authenticationManager;
    }

    public Authentication authenticate(LoginDTO dto) {
        String cpfLimpo = dto.getCpf() == null ? "" : dto.getCpf().replaceAll("\\D", "");
        UsernamePasswordAuthenticationToken credentials =
                UsernamePasswordAuthenticationToken.unauthenticated(cpfLimpo, dto.getPassword());
        return authenticationManager.authenticate(credentials);
    }

    public User findAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        return repository.findById(authentication.getName()).orElse(null);
    }
}
