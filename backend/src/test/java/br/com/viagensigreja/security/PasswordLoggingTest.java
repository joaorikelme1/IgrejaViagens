package br.com.viagensigreja.security;

import br.com.viagensigreja.dto.LoginDTO;
import br.com.viagensigreja.model.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;

class PasswordLoggingTest {

    @Test
    void loginDtoNaoIncluiPasswordNoToString() {
        LoginDTO dto = new LoginDTO();
        dto.setCpf("52998224725");
        dto.setPassword("segredo-irrepetivel");

        assertFalse(dto.toString().contains("segredo-irrepetivel"));
    }

    @Test
    void entidadeUserNaoIncluiPasswordNoToString() {
        User user = new User();
        user.setCpf("52998224725");
        user.setPassword("segredo-irrepetivel");

        assertFalse(user.toString().contains("segredo-irrepetivel"));
    }
}
