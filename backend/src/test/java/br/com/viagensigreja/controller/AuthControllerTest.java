package br.com.viagensigreja.controller;

import br.com.viagensigreja.dto.LoginDTO;
import br.com.viagensigreja.mapper.UserMapper;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class AuthControllerTest {

    private AuthService authService;
    private SecurityContextRepository securityContextRepository;
    private SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        securityContextRepository = mock(SecurityContextRepository.class);
        sessionAuthenticationStrategy = mock(SessionAuthenticationStrategy.class);
        AuthController controller = new AuthController(
                authService,
                new UserMapper(),
                securityContextRepository,
                sessionAuthenticationStrategy
        );
        mockMvc = standaloneSetup(controller).build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void loginNaoExpoePasswordNaResposta() throws Exception {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                "52998224725",
                null,
                List.of()
        );
        when(authService.authenticate(any(LoginDTO.class))).thenReturn(authentication);
        when(authService.findAuthenticatedUser(authentication)).thenReturn(usuarioComSenha());

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cpf\":\"52998224725\",\"password\":\"segredo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value("52998224725"))
                .andExpect(jsonPath("$.name").value("Maria"))
                .andExpect(jsonPath("$.birthdate").value("1990-05-12"))
                .andExpect(jsonPath("$.password").doesNotExist());

        verify(sessionAuthenticationStrategy).onAuthentication(
                eq(authentication),
                any(HttpServletRequest.class),
                any(HttpServletResponse.class)
        );
        verify(securityContextRepository).saveContext(
                any(SecurityContext.class),
                any(HttpServletRequest.class),
                any(HttpServletResponse.class)
        );
    }

    private User usuarioComSenha() {
        return new User(
                "52998224725",
                "Maria",
                "segredo",
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
