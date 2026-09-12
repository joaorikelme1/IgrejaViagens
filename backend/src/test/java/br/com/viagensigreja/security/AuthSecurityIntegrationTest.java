package br.com.viagensigreja.security;

import br.com.viagensigreja.model.User;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
class AuthSecurityIntegrationTest {

    private static final String CPF = "52998224725";
    private static final String FRONTEND_ORIGIN = "http://localhost:5173";

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TripRepository tripRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(applicationContext)
                .apply(springSecurity())
                .build();
        userRepository.deleteAll();
        tripRepository.deleteAll();
    }

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
        tripRepository.deleteAll();
    }

    @Test
    void loginValidoCriaAutenticacaoNaSessao() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-segura"));

        MvcResult login = autenticar("senha-segura")
                .andExpect(status().isOk())
                .andReturn();

        MockHttpSession session = sessionFrom(login);
        SecurityContext context = (SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY
        );

        assertNotNull(context);
        assertTrue(context.getAuthentication().isAuthenticated());
        assertEquals(CPF, context.getAuthentication().getName());
        assertNull(context.getAuthentication().getCredentials());
    }

    @Test
    void loginInvalidoRetornaUnauthorizedSemCriarAutenticacao() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-correta"));

        autenticar("senha-incorreta")
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("CPF ou senha incorretos."));
    }

    @Test
    void authMeRetornaUsuarioAutenticadoSemPassword() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-segura"));
        MockHttpSession session = sessionFrom(
                autenticar("senha-segura").andReturn()
        );

        mockMvc.perform(get("/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value(CPF))
                .andExpect(jsonPath("$.name").value("Maria"))
                .andExpect(jsonPath("$.role").value("traveler"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void logoutInvalidaSessao() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-segura"));
        MockHttpSession session = sessionFrom(
                autenticar("senha-segura").andReturn()
        );

        mockMvc.perform(post("/auth/logout").session(session).with(csrf()))
                .andExpect(status().isNoContent());

        assertTrue(session.isInvalid());
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioNaoAutenticadoNaoAcessaEndpointProtegido() throws Exception {
        mockMvc.perform(get("/trips"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void csrfTokenPublicoProtegeOperacoesDeEscrita() throws Exception {
        mockMvc.perform(get("/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty());

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cpf\":\"52998224725\",\"password\":\"senha\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void senhaLegadaContinuaAutenticandoSemRehash() throws Exception {
        salvarUsuario("senha-legada");

        autenticar("senha-legada")
                .andExpect(status().isOk());

        assertEquals("senha-legada", userRepository.findById(CPF).orElseThrow().getPassword());
    }

    @Test
    void senhaBCryptContinuaAutenticando() throws Exception {
        String hash = passwordEncoder.encode("senha-segura");
        salvarUsuario(hash);

        autenticar("senha-segura")
                .andExpect(status().isOk());

        assertEquals(hash, userRepository.findById(CPF).orElseThrow().getPassword());
    }

    @Test
    void travelerAutenticadoAcessaViagemAssociada() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-segura"));
        Trip trip = new Trip();
        trip.setId("trip-1");
        trip.setName("Viagem do viajante");
        trip.setTravelersJson("[\"" + CPF + "\"]");
        tripRepository.saveAndFlush(trip);
        MockHttpSession session = sessionFrom(
                autenticar("senha-segura").andReturn()
        );

        mockMvc.perform(get("/trips").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("trip-1"))
                .andExpect(jsonPath("$[0].travelersJson").value("[\"" + CPF + "\"]"));
    }

    @Test
    void corsPermiteOrigemLocalComCredenciaisSemWildcard() throws Exception {
        mockMvc.perform(options("/auth/me")
                        .header("Origin", FRONTEND_ORIGIN)
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", FRONTEND_ORIGIN))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void corsRejeitaOrigemNaoPermitida() throws Exception {
        mockMvc.perform(options("/auth/me")
                        .header("Origin", "http://example.invalid")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void authMeComSessaoRetornaCabecalhosCorsParaOrigemPermitida() throws Exception {
        salvarUsuario(passwordEncoder.encode("senha-segura"));
        MockHttpSession session = sessionFrom(
                autenticar("senha-segura").andReturn()
        );

        mockMvc.perform(get("/auth/me")
                        .session(session)
                        .header("Origin", FRONTEND_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", FRONTEND_ORIGIN))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    private org.springframework.test.web.servlet.ResultActions autenticar(String password) throws Exception {
        return mockMvc.perform(post("/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "cpf": "529.982.247-25",
                          "password": "%s"
                        }
                        """.formatted(password)));
    }

    private MockHttpSession sessionFrom(MvcResult result) {
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        return session;
    }

    private void salvarUsuario(String storedPassword) {
        User user = new User();
        user.setCpf(CPF);
        user.setName("Maria");
        user.setPassword(storedPassword);
        user.setRole("traveler");
        user.setBirthdate("1990-05-12");
        user.setFirstLogin(false);
        user.setMarried(false);
        user.setSpouseName("");
        user.setHasKids(false);
        user.setKids(new ArrayList<>());
        userRepository.saveAndFlush(user);
    }
}
