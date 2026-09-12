package br.com.viagensigreja.controller;

import br.com.viagensigreja.dto.UserResponseDTO;
import br.com.viagensigreja.mapper.TravelerResourceMapper;
import br.com.viagensigreja.mapper.UserMapper;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.TripService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/trips")
public class TripController {

    private final TripService service;
    private final ResourceAuthorizationService authorization;
    private final TravelerResourceMapper travelerMapper;
    private final UserMapper userMapper;

    public TripController(
            TripService service,
            ResourceAuthorizationService authorization,
            TravelerResourceMapper travelerMapper,
            UserMapper userMapper
    ) {
        this.service = service;
        this.authorization = authorization;
        this.travelerMapper = travelerMapper;
        this.userMapper = userMapper;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<?> listar(Authentication authentication) {
        if (authorization.isAdmin(authentication)) {
            return service.listar();
        }

        String cpf = authorization.authenticatedCpf(authentication);
        return authorization.accessibleTrips(authentication).stream()
                .map(trip -> travelerMapper.toTripResponse(trip, cpf))
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public Object buscar(@PathVariable String id, Authentication authentication) {
        if (authorization.isAdmin(authentication)) {
            return service.buscar(id);
        }

        authorization.requireTripAccess(authentication, id);
        return service.buscarOptional(id)
                .map(trip -> travelerMapper.toTripResponse(
                        trip,
                        authorization.authenticatedCpf(authentication)
                ))
                .orElse(null);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Trip criar(@RequestBody Trip trip) {
        return service.salvar(trip);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Trip atualizar(@PathVariable String id, @RequestBody Trip trip) {
        return service.atualizar(id, trip);
    }

    @PutMapping("/bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Trip> substituirTodos(@RequestBody List<Trip> trips) {
        return service.substituirTodos(trips);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deletar(@PathVariable String id) {
        service.deletar(id);
    }

    @PutMapping("/{id}/travelers/{cpf}")
    @PreAuthorize("hasRole('ADMIN')")
    public Trip adicionarViajante(@PathVariable String id, @PathVariable String cpf) {
        return service.adicionarViajante(id, cpf);
    }

    @PostMapping("/{id}/travelers")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponseDTO criarViajante(
            @PathVariable String id,
            @RequestBody User user
    ) {
        return userMapper.toResponse(service.criarViajante(id, user));
    }

    @DeleteMapping("/{id}/travelers/{cpf}")
    @PreAuthorize("hasRole('ADMIN')")
    public Trip removerViajante(@PathVariable String id, @PathVariable String cpf) {
        return service.removerViajante(id, cpf);
    }
}
