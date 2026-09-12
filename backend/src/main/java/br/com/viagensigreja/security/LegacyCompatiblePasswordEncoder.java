package br.com.viagensigreja.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;

/**
 * Codifica novas senhas com BCrypt e mantém, temporariamente, a leitura das
 * senhas legadas armazenadas em texto puro.
 *
 * <p>Este componente apenas sinaliza hashes legados por meio de
 * {@link #upgradeEncoding(String)}. A autenticação não executa rehash nem
 * persiste alterações automaticamente.</p>
 */
@Component
public class LegacyCompatiblePasswordEncoder implements PasswordEncoder {

    private static final Pattern BCRYPT_HASH = Pattern.compile(
            "^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$"
    );

    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    @Override
    public String encode(CharSequence rawPassword) {
        return bcrypt.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null) {
            return false;
        }

        if (isBcrypt(storedPassword)) {
            try {
                return bcrypt.matches(rawPassword, storedPassword);
            } catch (IllegalArgumentException exception) {
                return false;
            }
        }

        byte[] rawBytes = rawPassword.toString().getBytes(StandardCharsets.UTF_8);
        byte[] storedBytes = storedPassword.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(rawBytes, storedBytes);
    }

    @Override
    public boolean upgradeEncoding(String storedPassword) {
        return storedPassword != null
                && (!isBcrypt(storedPassword) || bcrypt.upgradeEncoding(storedPassword));
    }

    private boolean isBcrypt(String storedPassword) {
        return BCRYPT_HASH.matcher(storedPassword).matches();
    }
}
