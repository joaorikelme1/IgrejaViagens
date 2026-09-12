package br.com.viagensigreja.repository;

import br.com.viagensigreja.model.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

    @Override
    @EntityGraph(attributePaths = {"kids", "childCpfs"})
    List<User> findAll();

    @Override
    @EntityGraph(attributePaths = {"kids", "childCpfs"})
    Optional<User> findById(String cpf);

    @EntityGraph(attributePaths = {"kids", "childCpfs"})
    Optional<User> findByCpf(String cpf);

    long countByRoleIgnoreCase(String role);

}
