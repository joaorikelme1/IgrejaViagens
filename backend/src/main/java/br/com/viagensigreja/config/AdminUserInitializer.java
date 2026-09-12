package br.com.viagensigreja.config;

import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;

@Component
public class AdminUserInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final String adminCpf;
    private final String adminName;
    private final String adminPassword;

    public AdminUserInitializer(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap-admin.enabled:false}") boolean enabled,
            @Value("${app.bootstrap-admin.cpf:}") String adminCpf,
            @Value("${app.bootstrap-admin.name:Administrador}") String adminName,
            @Value("${app.bootstrap-admin.password:}") String adminPassword
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.adminCpf = normalizeCpf(adminCpf);
        this.adminName = adminName == null ? "" : adminName.trim();
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) {
            return;
        }
        if (adminCpf.length() != 11) {
            throw new IllegalStateException("ADMIN_CPF deve conter exatamente 11 digitos.");
        }
        if (userRepository.existsById(adminCpf)) {
            return;
        }
        if (adminName.isBlank()) {
            throw new IllegalStateException("ADMIN_NAME e obrigatorio para criar o administrador inicial.");
        }
        if (adminPassword == null || adminPassword.length() < 8) {
            throw new IllegalStateException(
                    "ADMIN_PASSWORD deve ter ao menos 8 caracteres quando o bootstrap estiver habilitado."
            );
        }

        User admin = new User();
        admin.setCpf(adminCpf);
        admin.setName(adminName);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole("admin");
        admin.setFirstLogin(false);
        admin.setMarried(false);
        admin.setHasKids(false);
        admin.setKids(new ArrayList<>());

        userRepository.save(admin);
    }

    private String normalizeCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }
}
