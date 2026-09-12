package br.com.viagensigreja.controller;

import br.com.viagensigreja.dto.ProfilePhotoDTO;
import br.com.viagensigreja.dto.UserResponseDTO;
import br.com.viagensigreja.mapper.UserMapper;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.UserService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService service;
    private final UserMapper userMapper;
    private final ResourceAuthorizationService authorization;

    public UserController(
            UserService service,
            UserMapper userMapper,
            ResourceAuthorizationService authorization
    ) {
        this.service = service;
        this.userMapper = userMapper;
        this.authorization = authorization;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponseDTO> listar() {
        return userMapper.toResponseList(service.listar());
    }

    @GetMapping("/{cpf}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public UserResponseDTO buscar(@PathVariable String cpf, Authentication authentication) {
        authorization.requireSelfOrAdmin(authentication, cpf);
        return userMapper.toResponse(service.buscarPorCpf(cpf.replaceAll("\\D", "")));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponseDTO criar(@RequestBody User user) {
        return userMapper.toResponse(service.criar(user));
    }

    @PutMapping("/{cpf}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public UserResponseDTO atualizar(
            @PathVariable String cpf,
            @RequestBody User user,
            Authentication authentication
    ) {
        String cpfLimpo = cpf.replaceAll("\\D", "");
        authorization.requireSelfOrAdmin(authentication, cpfLimpo);
        User updated = authorization.isAdmin(authentication)
                ? service.atualizar(cpfLimpo, user)
                : service.concluirPrimeiroAcesso(cpfLimpo, user.getPassword());
        return userMapper.toResponse(updated);
    }

    @PutMapping("/{cpf}/profile-photo")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public ProfilePhotoDTO atualizarFotoPerfil(
            @PathVariable String cpf,
            @RequestBody ProfilePhotoDTO request,
            Authentication authentication
    ) {
        String cpfLimpo = cpf.replaceAll("\\D", "");
        authorization.requireSelfOrAdmin(authentication, cpfLimpo);
        User updated = service.atualizarFotoPerfil(cpfLimpo, request.profilePhoto());
        return new ProfilePhotoDTO(updated.getProfilePhoto());
    }

    @PutMapping("/bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponseDTO> substituirTodos(@RequestBody List<User> users) {
        return userMapper.toResponseList(service.substituirTodos(users));
    }

    @DeleteMapping("/{cpf}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deletar(@PathVariable String cpf) {
        service.deletar(cpf.replaceAll("\\D", ""));
    }
}
