package br.com.viagensigreja.controller;

import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.PaymentService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService service;
    private final ResourceAuthorizationService authorization;

    public PaymentController(
            PaymentService service,
            ResourceAuthorizationService authorization
    ) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Payment> listar(Authentication authentication) {
        return service.listarVisiveis(authentication);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Payment criar(@RequestBody Payment payment) {
        return service.salvar(payment);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public Payment atualizar(
            @PathVariable String id,
            @RequestBody Payment payment,
            Authentication authentication
    ) {
        return service.atualizarCompativel(id, payment, authentication);
    }

    @PutMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Payment> substituirTodos(
            @RequestBody List<Payment> payments,
            Authentication authentication
    ) {
        return service.substituirCompativel(payments, authentication);
    }

    @GetMapping("/user/{cpf}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TRAVELER')")
    public List<Payment> listarPorUsuario(
            @PathVariable String cpf,
            Authentication authentication
    ) {
        authorization.requireSelfOrAdmin(authentication, cpf);
        return service.buscarPorUsuarioVisivel(cpf.replaceAll("\\D", ""), authentication);
    }
}
