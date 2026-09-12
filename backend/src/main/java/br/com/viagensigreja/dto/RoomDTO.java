package br.com.viagensigreja.dto;

import lombok.Data;

import java.util.List;

@Data
public class RoomDTO {

    private String type;
    private int capacity;

    private List<String> occupants;

    private String tripId;
}