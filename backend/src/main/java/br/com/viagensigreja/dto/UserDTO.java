package br.com.viagensigreja.dto;

import lombok.Data;

import java.util.List;

@Data
public class UserDTO {

    private String cpf;
    private String name;
    private String role;

    private boolean married;
    private String spouseName;
    private String spouseCpf;

    private boolean hasKids;
    private String profilePhoto;
    private List<String> kids;
    private List<String> childCpfs;
}
