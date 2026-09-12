package br.com.viagensigreja.dto;

import java.util.List;

/** Dados do próprio usuário autenticado, incluindo sua foto de perfil. */
public record AuthenticatedUserResponseDTO(
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
        List<String> childCpfs,
        String profilePhoto
) {
}
