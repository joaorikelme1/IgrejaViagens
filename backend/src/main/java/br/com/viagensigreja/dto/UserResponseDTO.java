package br.com.viagensigreja.dto;

import java.util.List;

/**
 * Contrato seguro de saída para usuários.
 *
 * <p>A credencial pertence somente ao modelo de persistência/entrada e não faz
 * parte de nenhuma resposta HTTP.</p>
 */
public record UserResponseDTO(
        String cpf,
        String name,
        String role,
        String birthdate,
        boolean firstLogin,
        boolean married,
        String spouseName,
        String spouseCpf,
        boolean hasKids,
        List<String> kids,
        List<String> childCpfs
) {
}
