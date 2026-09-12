package br.com.viagensigreja.mapper;

import br.com.viagensigreja.dto.UserResponseDTO;
import br.com.viagensigreja.model.User;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class UserMapper {

    public UserResponseDTO toResponse(User user) {
        if (user == null) {
            return null;
        }

        List<String> kids = user.getKids() == null
                ? List.of()
                : List.copyOf(user.getKids());
        List<String> childCpfs = user.getChildCpfs() == null
                ? List.of()
                : List.copyOf(user.getChildCpfs());

        return new UserResponseDTO(
                user.getCpf(),
                user.getName(),
                user.getRole(),
                user.getBirthdate(),
                user.isFirstLogin(),
                user.isMarried(),
                user.getSpouseName(),
                user.getSpouseCpf(),
                user.isHasKids(),
                kids,
                childCpfs
        );
    }

    public List<UserResponseDTO> toResponseList(List<User> users) {
        return users.stream()
                .map(this::toResponse)
                .toList();
    }
}
