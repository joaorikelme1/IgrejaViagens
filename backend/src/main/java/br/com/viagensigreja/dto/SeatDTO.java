package br.com.viagensigreja.dto;

import lombok.Data;

@Data
public class SeatDTO {

    private String tripId;
    private String busId;

    private int floor;
    private int seatNumber;

    private String userCpf;
}