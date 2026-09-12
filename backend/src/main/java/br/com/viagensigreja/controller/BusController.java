package br.com.viagensigreja.controller;

import br.com.viagensigreja.model.Bus;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.BusService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/buses")
public class BusController {

    private final BusService service;
    private final ResourceAuthorizationService authorization;

    public BusController(BusService service, ResourceAuthorizationService authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Bus criar(@RequestBody Bus bus) {
        return service.salvar(bus);
    }

    @GetMapping("/trip/{tripId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Bus> listarPorViagem(
            @PathVariable String tripId,
            Authentication authentication
    ) {
        authorization.requireTripAccess(authentication, tripId);
        return service.buscarPorTrip(tripId);
    }
}
