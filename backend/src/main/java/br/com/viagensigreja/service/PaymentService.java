package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.security.ResourceAuthorizationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class PaymentService {

    private final PaymentRepository repository;
    private final ResourceAuthorizationService authorization;
    private final ObjectMapper objectMapper;
    private final TripMembershipService membership;

    public PaymentService(
            PaymentRepository repository,
            ResourceAuthorizationService authorization,
            ObjectMapper objectMapper,
            TripMembershipService membership
    ) {
        this.repository = repository;
        this.authorization = authorization;
        this.objectMapper = objectMapper;
        this.membership = membership;
    }

    @Transactional
    public Payment salvar(Payment payment) {
        if (payment == null) {
            throw badRequest("Os dados do pagamento sao obrigatorios.");
        }
        String cpf = membership.normalizeCpf(payment.getUserCpf());
        String tripId = requiredText(payment.getTripId(), "Viagem");
        String id = payment.getId();
        if (id == null || id.isBlank()) {
            id = cpf + "_" + tripId;
        }
        return salvarComoAdmin(id, payment);
    }

    @Transactional
    public Payment atualizarCompativel(
            String id,
            Payment payment,
            Authentication authentication
    ) {
        if (id == null || id.isBlank() || payment == null) {
            throw badRequest("Os dados do pagamento sao obrigatorios.");
        }
        if (payment.getId() != null && !payment.getId().isBlank() && !id.equals(payment.getId())) {
            throw badRequest("O ID do pagamento nao corresponde ao recurso informado.");
        }
        if (authorization.isAdmin(authentication)) {
            return salvarComoAdmin(id, payment);
        }
        if (!authorization.isTraveler(authentication)) {
            throw new AccessDeniedException("Perfil sem permissao para editar pagamentos.");
        }
        return atualizarPagamentoDoViajante(id, payment, authentication);
    }

    public List<Payment> buscarPorUsuario(String cpf) {
        return repository.findByUserCpf(cpf);
    }

    public List<Payment> listarVisiveis(Authentication authentication) {
        if (authorization.isAdmin(authentication)) {
            return repository.findAll();
        }

        String cpf = authorization.authenticatedCpf(authentication);
        Set<String> tripIds = authorization.accessibleTripIds(authentication);
        return repository.findAll().stream()
                .filter(payment -> authorization.belongsTo(payment.getUserCpf(), cpf))
                .filter(payment -> tripIds.contains(payment.getTripId()))
                .toList();
    }

    public List<Payment> buscarPorUsuarioVisivel(String cpf, Authentication authentication) {
        if (authorization.isAdmin(authentication)) {
            return repository.findByUserCpf(cpf);
        }
        return listarVisiveis(authentication);
    }

    private Payment salvarComoAdmin(String id, Payment payment) {
        Payment existing = repository.findById(id).orElse(null);
        Payment prepared = prepararPagamentoAdmin(id, payment, existing);

        if (existing != null && (!Objects.equals(existing.getUserCpf(), prepared.getUserCpf())
                || !Objects.equals(existing.getTripId(), prepared.getTripId()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Um pagamento existente nao pode ser movido para outro viajante ou viagem."
            );
        }

        boolean duplicate = repository.findByUserCpfAndTripId(
                        prepared.getUserCpf(),
                        prepared.getTripId()
                ).stream()
                .anyMatch(current -> !current.getId().equals(id));
        if (duplicate) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ja existe um pagamento para este viajante nesta viagem."
            );
        }
        return repository.save(prepared);
    }

    private Payment atualizarPagamentoDoViajante(
            String id,
            Payment candidate,
            Authentication authentication
    ) {
        String cpf = authorization.authenticatedCpf(authentication);
        Set<String> accessibleTripIds = authorization.accessibleTripIds(authentication);
        validateTravelerIdentity(candidate, cpf, accessibleTripIds);

        List<Payment> matching = repository.findByUserCpfAndTripId(cpf, candidate.getTripId());
        if (matching.size() > 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ha pagamentos duplicados que precisam ser corrigidos por um administrador."
            );
        }

        Payment existing = matching.isEmpty() ? null : matching.get(0);
        if (existing != null && !existing.getId().equals(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "O ID informado nao corresponde ao pagamento desta viagem."
            );
        }
        if (existing == null) {
            String expectedId = cpf + "_" + candidate.getTripId();
            if (!expectedId.equals(id)) {
                throw badRequest("O ID de um novo pagamento e invalido.");
            }
        }

        Payment prepared = mergeTravelerPayment(existing, candidate, cpf);
        return repository.save(prepared);
    }

    private Payment prepararPagamentoAdmin(String id, Payment payment, Payment existing) {
        String tripId = requiredText(payment.getTripId(), "Viagem");
        String cpf = membership.requireTraveler(tripId, payment.getUserCpf());
        validatePlan(
                payment.getTotalInstallments(),
                payment.getDueDay(),
                payment.getPaidInstallments()
        );
        String receiptsJson = mergeAdminReceipts(
                existing == null ? null : existing.getReceiptsJson(),
                payment.getReceiptsJson(),
                payment.getTotalInstallments()
        );
        return new Payment(
                id,
                cpf,
                tripId,
                payment.getTotalInstallments(),
                payment.getPaidInstallments(),
                payment.getDueDay(),
                payment.isLocked(),
                receiptsJson
        );
    }

    /**
     * Mantem o contrato bulk usado pelo React atual. Para ADMIN a semantica
     * legada de substituicao integral e preservada. Para TRAVELER o mesmo
     * endpoint funciona apenas como upsert dos proprios registros, sem excluir
     * pagamentos omitidos e sem permitir alteracao de campos administrativos.
     */
    @Transactional
    public List<Payment> substituirCompativel(
            List<Payment> payments,
            Authentication authentication
    ) {
        if (authorization.isAdmin(authentication)) {
            return substituirTodosComoAdmin(payments);
        }
        if (!authorization.isTraveler(authentication)) {
            throw new AccessDeniedException("Perfil sem permissao para editar pagamentos.");
        }
        return atualizarPagamentosDoViajante(payments, authentication);
    }

    private List<Payment> substituirTodosComoAdmin(List<Payment> payments) {
        if (payments == null) {
            throw badRequest("A lista de pagamentos e obrigatoria.");
        }
        List<Payment> prepared = new ArrayList<>();
        Set<String> ids = new java.util.HashSet<>();
        Set<String> travelerTrips = new java.util.HashSet<>();
        for (Payment payment : payments) {
            if (payment == null) {
                throw badRequest("A lista de pagamentos possui um item vazio.");
            }
            String cpf = membership.normalizeCpf(payment.getUserCpf());
            String tripId = requiredText(payment.getTripId(), "Viagem");
            String id = payment.getId();
            if (id == null || id.isBlank()) {
                id = cpf + "_" + tripId;
            }
            Payment normalized = prepararPagamentoAdmin(id, payment, null);
            if (!ids.add(id)) {
                throw badRequest("A lista possui IDs de pagamento duplicados.");
            }
            if (!travelerTrips.add(normalized.getUserCpf() + "\n" + normalized.getTripId())) {
                throw badRequest("A lista possui pagamentos duplicados para um viajante e viagem.");
            }
            prepared.add(normalized);
        }

        repository.deleteAll();
        repository.flush();
        return repository.saveAll(prepared);
    }

    private List<Payment> atualizarPagamentosDoViajante(
            List<Payment> submitted,
            Authentication authentication
    ) {
        String cpf = authorization.authenticatedCpf(authentication);
        Set<String> accessibleTripIds = authorization.accessibleTripIds(authentication);
        List<Payment> current = repository.findAll();
        List<Payment> prepared = new ArrayList<>();
        Set<String> submittedTrips = new java.util.HashSet<>();

        for (Payment candidate : submitted) {
            validateTravelerIdentity(candidate, cpf, accessibleTripIds);
            if (!submittedTrips.add(candidate.getTripId())) {
                throw badRequest("Foi enviado mais de um pagamento para a mesma viagem.");
            }

            List<Payment> matching = current.stream()
                    .filter(payment -> authorization.belongsTo(payment.getUserCpf(), cpf))
                    .filter(payment -> Objects.equals(payment.getTripId(), candidate.getTripId()))
                    .toList();
            if (matching.size() > 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Ha pagamentos duplicados que precisam ser corrigidos por um administrador."
                );
            }

            prepared.add(mergeTravelerPayment(
                    matching.isEmpty() ? null : matching.get(0),
                    candidate,
                    cpf
            ));
        }

        repository.saveAll(prepared);
        return repository.findAll().stream()
                .filter(payment -> authorization.belongsTo(payment.getUserCpf(), cpf))
                .filter(payment -> accessibleTripIds.contains(payment.getTripId()))
                .toList();
    }

    private void validateTravelerIdentity(
            Payment candidate,
            String cpf,
            Set<String> accessibleTripIds
    ) {
        if (candidate == null
                || !authorization.belongsTo(candidate.getUserCpf(), cpf)
                || candidate.getTripId() == null
                || !accessibleTripIds.contains(candidate.getTripId())) {
            throw new AccessDeniedException(
                    "Viajantes so podem editar o proprio pagamento em viagens associadas."
            );
        }
    }

    private Payment mergeTravelerPayment(Payment existing, Payment candidate, String cpf) {
        int totalInstallments;
        int dueDay;
        boolean locked;
        int paidInstallments;
        String id;

        if (existing == null) {
            validatePlan(candidate.getTotalInstallments(), candidate.getDueDay(), 0);
            totalInstallments = candidate.getTotalInstallments();
            dueDay = candidate.getDueDay();
            locked = candidate.isLocked();
            paidInstallments = 0;
            id = cpf + "_" + candidate.getTripId();
        } else {
            id = existing.getId();
            paidInstallments = existing.getPaidInstallments();
            if (existing.isLocked()) {
                totalInstallments = existing.getTotalInstallments();
                dueDay = existing.getDueDay();
                locked = true;
            } else {
                validatePlan(
                        candidate.getTotalInstallments(),
                        candidate.getDueDay(),
                        paidInstallments
                );
                totalInstallments = candidate.getTotalInstallments();
                dueDay = candidate.getDueDay();
                locked = candidate.isLocked();
            }
        }

        String receiptsJson = mergeTravelerReceipts(
                existing == null ? null : existing.getReceiptsJson(),
                candidate.getReceiptsJson(),
                totalInstallments,
                locked
        );

        return new Payment(
                id,
                cpf,
                candidate.getTripId(),
                totalInstallments,
                paidInstallments,
                dueDay,
                locked,
                receiptsJson
        );
    }

    private void validatePlan(int totalInstallments, int dueDay, int paidInstallments) {
        if (totalInstallments < 1 || totalInstallments > 24) {
            throw badRequest("A quantidade de parcelas deve estar entre 1 e 24.");
        }
        if (dueDay < 1 || dueDay > 31) {
            throw badRequest("O dia de vencimento deve estar entre 1 e 31.");
        }
        if (paidInstallments < 0 || totalInstallments < paidInstallments) {
            throw badRequest("O total de parcelas nao pode ser menor que as parcelas ja pagas.");
        }
    }

    private String mergeAdminReceipts(
            String storedJson,
            String submittedJson,
            int totalInstallments
    ) {
        Map<String, Object> stored = parseJsonObject(storedJson, true);
        Map<String, Object> submitted = parseJsonObject(submittedJson, false);
        Map<String, Object> merged = new LinkedHashMap<>(stored);

        for (Map.Entry<String, Object> entry : submitted.entrySet()) {
            Map<String, Object> nextReceipt = asObject(entry.getValue());
            if (nextReceipt == null) {
                throw badRequest("O comprovante enviado possui formato invalido.");
            }
            validateReceiptNumber(entry.getKey(), totalInstallments);
            Map<String, Object> currentReceipt = asObject(stored.get(entry.getKey()));
            Map<String, Object> next = currentReceipt == null
                    ? new LinkedHashMap<>()
                    : new LinkedHashMap<>(currentReceipt);
            next.putAll(nextReceipt);
            validateAdminReceipt(next);
            merged.put(entry.getKey(), next);
        }

        for (Map.Entry<String, Object> entry : merged.entrySet()) {
            validateReceiptNumber(entry.getKey(), totalInstallments);
            Map<String, Object> receipt = asObject(entry.getValue());
            if (receipt == null) {
                throw badRequest("O comprovante persistido possui formato invalido.");
            }
            validateAdminReceipt(receipt);
        }

        try {
            return objectMapper.writeValueAsString(merged);
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel serializar os comprovantes.", exception);
        }
    }

    private void validateReceiptNumber(String installment, int totalInstallments) {
        int installmentNumber;
        try {
            installmentNumber = Integer.parseInt(installment);
        } catch (NumberFormatException exception) {
            throw badRequest("O numero da parcela do comprovante e invalido.");
        }
        if (installmentNumber < 1 || installmentNumber > totalInstallments) {
            throw badRequest("O comprovante nao pertence a uma parcela valida do plano.");
        }
    }

    private void validateAdminReceipt(Map<String, Object> receipt) {
        if (!(receipt.get("data") instanceof String data) || data.isBlank()) {
            throw badRequest("O conteudo do comprovante e obrigatorio.");
        }
        Object status = receipt.get("status");
        if (!(status instanceof String value)
                || !Set.of("pending", "approved", "rejected").contains(value)) {
            throw badRequest("O status do comprovante e invalido.");
        }
    }

    private String mergeTravelerReceipts(
            String storedJson,
            String submittedJson,
            int totalInstallments,
            boolean locked
    ) {
        Map<String, Object> stored = parseJsonObject(storedJson, true);
        Map<String, Object> submitted = parseJsonObject(submittedJson, false);
        Map<String, Object> merged = new LinkedHashMap<>(stored);

        for (Map.Entry<String, Object> entry : submitted.entrySet()) {
            Map<String, Object> nextReceipt = asObject(entry.getValue());
            if (nextReceipt == null) {
                throw badRequest("O comprovante enviado possui formato invalido.");
            }

            Map<String, Object> currentReceipt = asObject(stored.get(entry.getKey()));
            if (currentReceipt == null) {
                if (stored.containsKey(entry.getKey())) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Um comprovante persistido exige revisao administrativa."
                    );
                }
                validateReceiptUpload(entry.getKey(), nextReceipt, totalInstallments, locked);
                merged.put(entry.getKey(), sanitizeNewReceipt(nextReceipt));
                continue;
            }

            if (!receiptFileChanged(currentReceipt, nextReceipt)
                    || "approved".equals(currentReceipt.get("status"))) {
                merged.put(entry.getKey(), currentReceipt);
                continue;
            }

            validateReceiptUpload(entry.getKey(), nextReceipt, totalInstallments, locked);
            Map<String, Object> reuploaded = new LinkedHashMap<>(currentReceipt);
            copyReceiptFileFields(nextReceipt, reuploaded);
            reuploaded.put("status", "pending");
            reuploaded.put("note", "");
            merged.put(entry.getKey(), reuploaded);
        }

        try {
            return objectMapper.writeValueAsString(merged);
        } catch (Exception exception) {
            throw new IllegalStateException("Nao foi possivel serializar os comprovantes.", exception);
        }
    }

    private void validateReceiptUpload(
            String installment,
            Map<String, Object> receipt,
            int totalInstallments,
            boolean locked
    ) {
        int installmentNumber;
        try {
            installmentNumber = Integer.parseInt(installment);
        } catch (NumberFormatException exception) {
            throw badRequest("O numero da parcela do comprovante e invalido.");
        }
        if (!locked || installmentNumber < 1 || installmentNumber > totalInstallments) {
            throw badRequest("O comprovante nao pertence a uma parcela valida do plano.");
        }
        if (!(receipt.get("data") instanceof String data) || data.isBlank()) {
            throw badRequest("O conteudo do comprovante e obrigatorio.");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonObject(String json, boolean storedValue) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Object parsed = objectMapper.readValue(json, Map.class);
            if (parsed instanceof Map<?, ?> map) {
                Map<String, Object> result = new LinkedHashMap<>();
                map.forEach((key, value) -> result.put(String.valueOf(key), value));
                return result;
            }
        } catch (Exception ignored) {
            // A mensagem abaixo distingue dado persistido inconsistente de entrada invalida.
        }

        if (storedValue) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Os comprovantes persistidos estao invalidos e exigem revisao administrativa."
            );
        }
        throw badRequest("O JSON de comprovantes enviado e invalido.");
    }

    private Map<String, Object> asObject(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, entryValue) -> result.put(String.valueOf(key), entryValue));
        return result;
    }

    private Map<String, Object> sanitizeNewReceipt(Map<String, Object> submitted) {
        Map<String, Object> sanitized = new LinkedHashMap<>();
        copyReceiptFileFields(submitted, sanitized);
        sanitized.put("status", "pending");
        sanitized.put("note", "");
        return sanitized;
    }

    private void copyReceiptFileFields(Map<String, Object> source, Map<String, Object> target) {
        for (String field : List.of("data", "date", "filename", "fileName", "type")) {
            Object value = source.get(field);
            if (value instanceof String) {
                target.put(field, value);
            }
        }
    }

    private boolean receiptFileChanged(
            Map<String, Object> current,
            Map<String, Object> submitted
    ) {
        return List.of("data", "date", "filename", "fileName", "type").stream()
                .anyMatch(field -> !Objects.equals(current.get(field), submitted.get(field)));
    }

    private String requiredText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw badRequest(label + " e obrigatoria.");
        }
        return value.trim();
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
