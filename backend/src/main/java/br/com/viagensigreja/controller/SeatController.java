package br.com.viagensigreja.controller;

import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.SeatService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/seats")
public class SeatController {

    private final SeatService service;
    private final SeatRepository repository;
    private final ResourceAuthorizationService authorization;

    public SeatController(
            SeatService service,
            SeatRepository repository,
            ResourceAuthorizationService authorization
    ) {
        this.service = service;
        this.repository = repository;
        this.authorization = authorization;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Seat> listar(Authentication authentication) {
        if (authorization.isAdmin(authentication)) {
            return repository.findAll();
        }

        String cpf = authorization.authenticatedCpf(authentication);
        var tripIds = authorization.accessibleTripIds(authentication);
        return repository.findAll().stream()
                .filter(seat -> authorization.belongsTo(seat.getUserCpf(), cpf))
                .filter(seat -> tripIds.contains(seat.getTripId()))
                .toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Seat criar(@RequestBody Seat seat) {
        return service.salvar(seat);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Seat atualizar(@PathVariable String id, @RequestBody Seat seat) {
        return service.atualizar(id, seat);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deletar(@PathVariable String id, @RequestParam String tripId) {
        service.deletar(id, tripId);
    }

    @PutMapping("/bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Seat> substituirTodos(@RequestBody List<Seat> seats) {
        return service.substituirTodos(seats);
    }

    @PutMapping("/trip/{tripId}/bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Seat> substituirDaViagem(
            @PathVariable String tripId,
            @RequestBody List<Seat> seats
    ) {
        return service.substituirDaViagem(tripId, seats);
    }

    @GetMapping("/trip/{tripId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Seat> listarPorViagem(
            @PathVariable String tripId,
            Authentication authentication
    ) {
        if (authorization.isAdmin(authentication)) {
            return service.buscarPorTrip(tripId);
        }

        authorization.requireTripAccess(authentication, tripId);
        String cpf = authorization.authenticatedCpf(authentication);
        return service.buscarPorTrip(tripId).stream()
                .filter(seat -> authorization.belongsTo(seat.getUserCpf(), cpf))
                .toList();
    }

    @GetMapping("/user/{cpf}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Seat> listarPorUsuario(
            @PathVariable String cpf,
            Authentication authentication
    ) {
        authorization.requireSelfOrAdmin(authentication, cpf);
        if (authorization.isAdmin(authentication)) {
            return service.buscarPorUsuario(cpf.replaceAll("\\D", ""));
        }
        return listar(authentication);
    }
}
