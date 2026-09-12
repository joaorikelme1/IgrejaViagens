package br.com.viagensigreja.controller;

import br.com.viagensigreja.mapper.UserMapper;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class UserControllerTest {

    private UserService userService;
    private ResourceAuthorizationService authorization;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        authorization = mock(ResourceAuthorizationService.class);
        UserController controller = new UserController(
                userService,
                new UserMapper(),
                authorization
        );
        mockMvc = standaloneSetup(controller).build();
    }

    @Test
    void listarUsuariosNaoExpoePassword() throws Exception {
        when(userService.listar()).thenReturn(List.of(usuarioComSenha()));

        mockMvc.perform(get("/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cpf").value("52998224725"))
                .andExpect(jsonPath("$[0].firstLogin").value(true))
                .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void criarUsuarioNaoExpoePassword() throws Exception {
        when(userService.criar(any(User.class))).thenReturn(usuarioComSenha());

        mockMvc.perform(post("/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpf": "529.982.247-25",
                                  "name": "Maria",
                                  "password": "segredo",
                                  "role": "traveler",
                                  "birthdate": "1990-05-12",
                                  "firstLogin": true,
                                  "married": false,
                                  "spouseName": "",
                                  "hasKids": false,
                                  "kids": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value("52998224725"))
                .andExpect(jsonPath("$.name").value("Maria"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void atualizaFotoDoProprioPerfil() throws Exception {
        User user = usuarioComSenha();
        String photo = "data:image/png;base64,YWJj";
        user.setProfilePhoto(photo);
        when(userService.atualizarFotoPerfil("52998224725", photo)).thenReturn(user);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                "52998224725",
                null,
                List.of()
        );

        mockMvc.perform(put("/users/52998224725/profile-photo")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profilePhoto\":\"data:image/png;base64,YWJj\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profilePhoto").value(photo));

        verify(authorization).requireSelfOrAdmin(authentication, "52998224725");
    }

    private User usuarioComSenha() {
        return new User(
                "52998224725",
                "Maria",
                "segredo",
                "traveler",
                "1990-05-12",
                true,
                false,
                "",
                false,
                List.of()
        );
    }
}
