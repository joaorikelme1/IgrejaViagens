package br.com.viagensigreja.ai;

import br.com.viagensigreja.model.MobilityRequirement;
import br.com.viagensigreja.model.SeatRegion;

import java.util.List;

/**
 * Contrato sem identificadores pessoais para futuras integracoes de planejamento.
 * Os aliases sao validos somente para o estado representado pelo snapshotHash.
 */
public record TripPlanningSnapshot(
        String snapshotHash,
        Long sourceVersion,
        TripContext trip,
        List<Traveler> travelers,
        List<FamilyLink> familyLinks,
        List<Preference> preferences,
        List<Bus> buses,
        List<Hotel> hotels,
        List<Room> rooms,
        List<Seat> seats,
        List<Payment> payments
) {
    public record TripContext(
            String name,
            String destination,
            String departurePlace,
            String departureTime,
            String date,
            int maxPeople,
            double price,
            double arrecadationGoal,
            String rules
    ) {
    }

    public record Traveler(String alias, boolean tripMember) {
    }

    public record FamilyLink(String type, String firstTraveler, String secondTraveler) {
    }

    public record Preference(
            String traveler,
            boolean includedInAiPlanning,
            MobilityRequirement mobilityRequirement,
            SeatRegion seatRegion,
            Integer preferredBusFloor,
            String preferredRoomType,
            List<String> companions,
            List<String> separatedFrom
    ) {
    }

    public record Bus(
            String alias,
            int floors,
            int seats,
            int seatsFloor1,
            int seatsFloor2
    ) {
    }

    public record Hotel(String alias, String name) {
    }

    public record Room(
            String alias,
            String hotel,
            String name,
            String type,
            int capacity,
            List<String> occupants
    ) {
    }

    public record Seat(
            String alias,
            String bus,
            int floor,
            int seatNumber,
            String traveler
    ) {
    }

    public record Payment(
            String alias,
            String traveler,
            int totalInstallments,
            int paidInstallments,
            int dueDay,
            boolean locked
    ) {
    }
}
