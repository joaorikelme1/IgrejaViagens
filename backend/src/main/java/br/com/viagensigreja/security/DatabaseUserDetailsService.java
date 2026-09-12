package br.com.viagensigreja.security;

import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public DatabaseUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String cpf = normalizeCpf(username);
        User user = userRepository.findById(cpf)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado."));

        return org.springframework.security.core.userdetails.User
                .withUsername(user.getCpf())
                .password(user.getPassword() == null ? "" : user.getPassword())
                .authorities(toAuthority(user.getRole()))
                .build();
    }

    private String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private String toAuthority(String role) {
        String normalizedRole = role == null ? "" : role.toLowerCase(Locale.ROOT);
        return switch (normalizedRole) {
            case "admin" -> "ROLE_ADMIN";
            case "traveler" -> "ROLE_TRAVELER";
            default -> throw new UsernameNotFoundException("Usuário com perfil inválido.");
        };
    }
}
