package br.com.viagensigreja.controller;

import br.com.viagensigreja.dto.AiPlanApplicationResponse;
import br.com.viagensigreja.dto.AiPlanGenerationRequest;
import br.com.viagensigreja.dto.AiPlanResponse;
import br.com.viagensigreja.dto.AiPlanningStatusResponse;
import br.com.viagensigreja.dto.AiUsageResponse;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import br.com.viagensigreja.service.AiPlanningService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/ai")
@PreAuthorize("hasRole('ADMIN')")
public class AiPlanningController {

    private final AiPlanningService service;
    private final ResourceAuthorizationService authorization;

    public AiPlanningController(
            AiPlanningService service,
            ResourceAuthorizationService authorization
    ) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping("/status")
    public AiPlanningStatusResponse status() {
        return service.status();
    }

    @GetMapping("/usage")
    public AiUsageResponse usage(@RequestParam String tripId) {
        return service.usage(tripId);
    }

    @GetMapping("/plans")
    public List<AiPlanResponse> list(@RequestParam String tripId) {
        return service.list(tripId);
    }

    @GetMapping("/plans/{planId}")
    public AiPlanResponse get(@PathVariable String planId) {
        return service.get(planId);
    }

    @PostMapping("/plans")
    public AiPlanResponse generate(
            Authentication authentication,
            @RequestBody AiPlanGenerationRequest request
    ) {
        return service.generate(authorization.authenticatedCpf(authentication), request);
    }

    @PostMapping("/plans/{planId}/apply")
    public AiPlanApplicationResponse apply(@PathVariable String planId) {
        return service.apply(planId);
    }

    @PostMapping("/plans/{planId}/discard")
    public AiPlanResponse discard(@PathVariable String planId) {
        return service.discard(planId);
    }
}
