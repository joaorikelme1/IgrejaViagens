package br.com.viagensigreja.security;

import br.com.viagensigreja.model.Bus;
import br.com.viagensigreja.model.Payment;
import br.com.viagensigreja.model.Room;
import br.com.viagensigreja.model.Seat;
import br.com.viagensigreja.model.Trip;
import br.com.viagensigreja.model.User;
import br.com.viagensigreja.repository.BusRepository;
import br.com.viagensigreja.repository.PaymentRepository;
import br.com.viagensigreja.repository.RoomRepository;
import br.com.viagensigreja.repository.SeatRepository;
import br.com.viagensigreja.repository.TripRepository;
import br.com.viagensigreja.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
class RoleAuthorizationIntegrationTest {

    private static final String ADMIN_CPF = "11144477735";
    private static final String TRAVELER_CPF = "52998224725";
    private static final String OTHER_CPF = "12345678909";
    private static final String COMPANION_CPF = "98765432100";
    private static final String OWN_TRIP = "trip-own";
    private static final String OTHER_TRIP = "trip-other";

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private BusRepository busRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(applicationContext)
                .apply(springSecurity())
                .build();

        paymentRepository.deleteAll();
        seatRepository.deleteAll();
        roomRepository.deleteAll();
        busRepository.deleteAll();
        tripRepository.deleteAll();
        userRepository.deleteAll();

        userRepository.saveAll(List.of(
                user(ADMIN_CPF, "Administrador", passwordEncoder.encode("admin-secret"), "admin", false),
                user(TRAVELER_CPF, "Viajante", "legacy-secret", "traveler", false),
                user(OTHER_CPF, "Outro viajante", passwordEncoder.encode("other-secret"), "traveler", false)
        ));
        tripRepository.saveAll(List.of(
                trip(OWN_TRIP, "Viagem permitida", "[\"" + TRAVELER_CPF + "\",\"" + COMPANION_CPF + "\"]"),
                trip(OTHER_TRIP, "Viagem privada", "[\"" + OTHER_CPF + "\"]"),
                trip("trip-malformed", "Viagem inconsistente", "not-json")
        ));
        paymentRepository.saveAll(List.of(
                payment("pay-own", TRAVELER_CPF, OWN_TRIP, 4, 1, true, "{}"),
                payment("pay-other", OTHER_CPF, OTHER_TRIP, 3, 2, true, "{}")
        ));
        seatRepository.saveAll(List.of(
                new Seat("seat-own", OWN_TRIP, "bus-own", 1, 7, TRAVELER_CPF),
                new Seat("seat-other", OTHER_TRIP, "bus-other", 1, 9, OTHER_CPF)
        ));
        roomRepository.saveAll(List.of(
                new Room("room-own", "double", 2, "Quarto 1", "hotel-1",
                        List.of(TRAVELER_CPF, COMPANION_CPF), OWN_TRIP),
                new Room("room-other", "single", 1, "Quarto 2", "hotel-2",
                        List.of(OTHER_CPF), OTHER_TRIP)
        ));
        busRepository.saveAll(List.of(
                new Bus("bus-own", 1, 40, 40, 0, OWN_TRIP),
                new Bus("bus-other", 1, 30, 30, 0, OTHER_TRIP)
        ));
    }

    @Test
    void unauthenticatedRequestReceivesJson401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.path").value("/users"));
    }

    @Test
    void adminKeepsAdministrativeAccessAndBulkReplacementSemantics() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");

        mockMvc.perform(get("/users").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].password").doesNotExist());
        mockMvc.perform(get("/trips").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
        mockMvc.perform(get("/rooms").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/seats").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        Payment replacement = payment(
                "admin-replacement", TRAVELER_CPF, OWN_TRIP, 2, 1, true, "{}"
        );
        mockMvc.perform(put("/payments/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(List.of(replacement))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("admin-replacement"));

        assertEquals(1, paymentRepository.count());
    }

    @Test
    void travelerCannotAccessAdministrativeOperationsAndReceivesJson403() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");

        mockMvc.perform(get("/users").session(session))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(403));
        mockMvc.perform(post("/trips")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(trip("new-trip", "Nova", "[]"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/trips/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/rooms/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/seats/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/users/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/payments")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(payment(
                                "forged", TRAVELER_CPF, OWN_TRIP, 1, 0, false, "{}"
                        ))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/rooms")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(new Room())))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/seats")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(new Seat())))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/buses")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(new Bus())))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/users/{cpf}", OTHER_CPF).session(session).with(csrf()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/trips/{id}", OTHER_TRIP).session(session).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void travelerOnlyReceivesOwnResourcesAndMaskedRoomCompanions() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");

        mockMvc.perform(get("/trips").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(OWN_TRIP))
                .andExpect(jsonPath("$[0].travelersJson")
                        .value("[\"" + TRAVELER_CPF + "\"]"));
        mockMvc.perform(get("/payments").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userCpf").value(TRAVELER_CPF));
        mockMvc.perform(get("/seats").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userCpf").value(TRAVELER_CPF));
        mockMvc.perform(get("/rooms").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].occupants[0]").value(TRAVELER_CPF))
                .andExpect(jsonPath("$[0].occupants[1]").value("2100"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(COMPANION_CPF)
                )));
        mockMvc.perform(get("/buses/trip/{tripId}", OWN_TRIP).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("bus-own"));
        mockMvc.perform(get("/users/{cpf}", TRAVELER_CPF).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value(TRAVELER_CPF))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void travelerCannotReadOtherUserOrOtherTrip() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");

        mockMvc.perform(get("/users/{cpf}", OTHER_CPF).session(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/payments/user/{cpf}", OTHER_CPF).session(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/seats/user/{cpf}", OTHER_CPF).session(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/trips/{id}", OTHER_TRIP).session(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/rooms/trip/{tripId}", OTHER_TRIP).session(session))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/buses/trip/{tripId}", OTHER_TRIP).session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    void travelerBulkRejectsThirdPartyRecordWithoutChangingAnyPayment() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");
        List<Payment> malicious = List.of(
                payment("pay-own", TRAVELER_CPF, OWN_TRIP, 4, 4, false, "{}"),
                payment("pay-other", OTHER_CPF, OTHER_TRIP, 1, 0, false, "{}")
        );

        mockMvc.perform(put("/payments/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(malicious)))
                .andExpect(status().isForbidden());

        assertEquals(2, paymentRepository.count());
        assertEquals(1, paymentRepository.findById("pay-own").orElseThrow().getPaidInstallments());
        assertEquals(2, paymentRepository.findById("pay-other").orElseThrow().getPaidInstallments());
    }

    @Test
    void travelerBulkPreservesAdminFieldsAndOtherUsersWhileAllowingReceiptReupload() throws Exception {
        Payment own = payment(
                "pay-own",
                TRAVELER_CPF,
                OWN_TRIP,
                4,
                1,
                true,
                """
                {
                  "1":{"data":"approved-data","filename":"approved.pdf","status":"approved","note":"ok","adminField":"keep"},
                  "2":{"data":"old-data","filename":"old.pdf","status":"rejected","note":"ilegivel","adminField":"keep"}
                }
                """
        );
        paymentRepository.saveAndFlush(own);
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");
        Payment submitted = payment(
                "forged-id",
                TRAVELER_CPF,
                OWN_TRIP,
                1,
                4,
                false,
                """
                {
                  "1":{"data":"tampered","filename":"tampered.pdf","status":"rejected","note":"changed"},
                  "2":{"data":"new-data","filename":"new.pdf","status":"approved","note":"hacked"}
                }
                """
        );

        mockMvc.perform(put("/payments/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(List.of(submitted))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("pay-own"))
                .andExpect(jsonPath("$[0].totalInstallments").value(4))
                .andExpect(jsonPath("$[0].paidInstallments").value(1))
                .andExpect(jsonPath("$[0].dueDay").value(10))
                .andExpect(jsonPath("$[0].locked").value(true));

        assertTrue(paymentRepository.existsById("pay-other"));
        Payment saved = paymentRepository.findById("pay-own").orElseThrow();
        Map<?, ?> receipts = objectMapper.readValue(saved.getReceiptsJson(), Map.class);
        Map<?, ?> approved = (Map<?, ?>) receipts.get("1");
        Map<?, ?> reuploaded = (Map<?, ?>) receipts.get("2");
        assertEquals("approved-data", approved.get("data"));
        assertEquals("approved", approved.get("status"));
        assertEquals("keep", approved.get("adminField"));
        assertEquals("new-data", reuploaded.get("data"));
        assertEquals("pending", reuploaded.get("status"));
        assertEquals("", reuploaded.get("note"));
        assertEquals("keep", reuploaded.get("adminField"));
    }

    @Test
    void travelerCanLockOwnPreviouslyUnlockedPlan() throws Exception {
        paymentRepository.saveAndFlush(payment(
                "pay-own", TRAVELER_CPF, OWN_TRIP, 1, 0, false, "{}"
        ));
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");
        Payment submitted = payment(
                "ignored-id", TRAVELER_CPF, OWN_TRIP, 6, 5, true, "{}"
        );
        submitted.setDueDay(20);

        mockMvc.perform(put("/payments/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(List.of(submitted))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalInstallments").value(6))
                .andExpect(jsonPath("$[0].paidInstallments").value(0))
                .andExpect(jsonPath("$[0].dueDay").value(20))
                .andExpect(jsonPath("$[0].locked").value(true));
    }

    @Test
    void firstAccessOnlyChangesOwnPasswordAndCannotElevateRole() throws Exception {
        User traveler = userRepository.findById(TRAVELER_CPF).orElseThrow();
        traveler.setFirstLogin(true);
        userRepository.saveAndFlush(traveler);
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");

        User maliciousBody = user(
                ADMIN_CPF,
                "Nome adulterado",
                "new-secret",
                "admin",
                false
        );
        mockMvc.perform(put("/users/{cpf}", TRAVELER_CPF)
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(maliciousBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value(TRAVELER_CPF))
                .andExpect(jsonPath("$.name").value("Viajante"))
                .andExpect(jsonPath("$.role").value("traveler"))
                .andExpect(jsonPath("$.firstLogin").value(false))
                .andExpect(jsonPath("$.password").doesNotExist());

        User saved = userRepository.findById(TRAVELER_CPF).orElseThrow();
        assertEquals("traveler", saved.getRole());
        assertEquals("Viajante", saved.getName());
        assertNotEquals("new-secret", saved.getPassword());
        assertTrue(passwordEncoder.matches("new-secret", saved.getPassword()));

        mockMvc.perform(put("/users/{cpf}", TRAVELER_CPF)
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(maliciousBody)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/users").session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    void malformedTravelerJsonFailsClosed() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");
        Payment candidate = payment(
                "forged", TRAVELER_CPF, "trip-malformed", 1, 0, true, "{}"
        );

        mockMvc.perform(get("/trips").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("trip-malformed")
                )));
        mockMvc.perform(put("/payments/bulk")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(List.of(candidate))))
                .andExpect(status().isForbidden());
    }

    @Test
    void healthCheckIsPublicAndConfirmsDatabaseConnection() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void granularPaymentUpdatePreservesOtherPaymentsAndServerReceiptMetadata() throws Exception {
        Payment existing = payment(
                "pay-own",
                TRAVELER_CPF,
                OWN_TRIP,
                4,
                1,
                true,
                """
                {"1":{"data":"receipt-data","status":"pending","providerChecksum":"keep"}}
                """
        );
        paymentRepository.saveAndFlush(existing);
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        Payment update = payment(
                "pay-own",
                TRAVELER_CPF,
                OWN_TRIP,
                4,
                2,
                true,
                """
                {"1":{"data":"receipt-data","status":"approved","note":"ok"}}
                """
        );

        mockMvc.perform(put("/payments/{id}", "pay-own")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paidInstallments").value(2));

        assertTrue(paymentRepository.existsById("pay-other"));
        Map<?, ?> receipts = objectMapper.readValue(
                paymentRepository.findById("pay-own").orElseThrow().getReceiptsJson(),
                Map.class
        );
        Map<?, ?> receipt = (Map<?, ?>) receipts.get("1");
        assertEquals("approved", receipt.get("status"));
        assertEquals("keep", receipt.get("providerChecksum"));
    }

    @Test
    void granularTravelerPaymentUpdateCannotForgeAdministrativeFields() throws Exception {
        MockHttpSession session = login(TRAVELER_CPF, "legacy-secret");
        Payment submitted = payment(
                "pay-own", TRAVELER_CPF, OWN_TRIP, 2, 2, false, "{}"
        );
        submitted.setDueDay(25);

        mockMvc.perform(put("/payments/{id}", "pay-own")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(submitted)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalInstallments").value(4))
                .andExpect(jsonPath("$.paidInstallments").value(1))
                .andExpect(jsonPath("$.dueDay").value(10))
                .andExpect(jsonPath("$.locked").value(true));

        assertTrue(paymentRepository.existsById("pay-other"));
    }

    @Test
    void granularRoomUpdatePreservesOthersAndRejectsInvalidOccupancy() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        Room update = new Room(
                "room-own",
                "double",
                2,
                "Quarto atualizado",
                "hotel-1",
                List.of(TRAVELER_CPF, COMPANION_CPF),
                OWN_TRIP
        );

        mockMvc.perform(put("/rooms/{id}", "room-own")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Quarto atualizado"));

        assertTrue(roomRepository.existsById("room-other"));

        Room overCapacity = new Room(
                "room-own",
                "single",
                1,
                "Quarto invalido",
                "hotel-1",
                List.of(TRAVELER_CPF, COMPANION_CPF),
                OWN_TRIP
        );
        mockMvc.perform(put("/rooms/{id}", "room-own")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(overCapacity)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "A quantidade de ocupantes excede a capacidade do quarto."
                ));
    }

    @Test
    void granularSeatCommandsRejectDoubleBookingAndDeleteOnlyTheTarget() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        Seat duplicate = new Seat(
                "seat-duplicate", OWN_TRIP, "bus-own", 1, 7, COMPANION_CPF
        );

        mockMvc.perform(put("/seats/{id}", "seat-duplicate")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(duplicate)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Este assento ja esta ocupado."));

        mockMvc.perform(delete("/seats/{id}", "seat-own")
                        .queryParam("tripId", OWN_TRIP)
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        assertFalse(seatRepository.existsById("seat-own"));
        assertTrue(seatRepository.existsById("seat-other"));
    }

    @Test
    void deletingTripCascadesDependentResourcesInBackend() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");

        mockMvc.perform(delete("/trips/{id}", OWN_TRIP).session(session).with(csrf()))
                .andExpect(status().isOk());

        assertFalse(tripRepository.existsById(OWN_TRIP));
        assertFalse(paymentRepository.existsById("pay-own"));
        assertFalse(seatRepository.existsById("seat-own"));
        assertFalse(roomRepository.existsById("room-own"));
        assertFalse(busRepository.existsById("bus-own"));
        assertTrue(tripRepository.existsById(OTHER_TRIP));
        assertTrue(paymentRepository.existsById("pay-other"));
    }

    @Test
    void deletingUserCleansAllAssociationsAndKeepsOtherUsersData() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");

        mockMvc.perform(delete("/users/{cpf}", TRAVELER_CPF).session(session).with(csrf()))
                .andExpect(status().isOk());

        assertFalse(userRepository.existsById(TRAVELER_CPF));
        assertFalse(paymentRepository.existsById("pay-own"));
        assertFalse(seatRepository.existsById("seat-own"));
        assertFalse(tripRepository.findById(OWN_TRIP).orElseThrow()
                .getTravelersJson().contains(TRAVELER_CPF));
        assertFalse(roomRepository.findById("room-own").orElseThrow()
                .getOccupants().contains(TRAVELER_CPF));
        assertTrue(userRepository.existsById(OTHER_CPF));
        assertTrue(paymentRepository.existsById("pay-other"));
    }

    @Test
    void lastAdministratorCannotBeDeleted() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");

        mockMvc.perform(delete("/users/{cpf}", ADMIN_CPF).session(session).with(csrf()))
                .andExpect(status().isConflict());

        assertTrue(userRepository.existsById(ADMIN_CPF));
    }

    @Test
    void lastAdministratorCannotLoseAdminRole() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        User demoted = user(ADMIN_CPF, "Administrador", null, "traveler", false);

        mockMvc.perform(put("/users/{cpf}", ADMIN_CPF)
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(demoted)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "O ultimo administrador do sistema nao pode perder esse perfil."
                ));

        assertEquals("admin", userRepository.findById(ADMIN_CPF).orElseThrow().getRole());
    }

    @Test
    void adminAddsAndRemovesTravelerWithDependentDataAtomically() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");

        mockMvc.perform(put("/trips/{id}/travelers/{cpf}", OWN_TRIP, OTHER_CPF)
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        assertTrue(tripRepository.findById(OWN_TRIP).orElseThrow()
                .getTravelersJson().contains(OTHER_CPF));
        assertTrue(paymentRepository.findFirstByUserCpfAndTripId(OTHER_CPF, OWN_TRIP)
                .isPresent());

        mockMvc.perform(delete("/trips/{id}/travelers/{cpf}", OWN_TRIP, TRAVELER_CPF)
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isOk());

        assertTrue(userRepository.existsById(TRAVELER_CPF));
        assertFalse(paymentRepository.existsById("pay-own"));
        assertFalse(seatRepository.existsById("seat-own"));
        assertFalse(roomRepository.findById("room-own").orElseThrow()
                .getOccupants().contains(TRAVELER_CPF));
    }

    @Test
    void adminCreatesAndAssociatesTravelerInOneRequest() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        User newTraveler = user(
                "93541134780",
                "Novo viajante",
                "temporary-secret",
                "admin",
                false
        );

        mockMvc.perform(post("/trips/{id}/travelers", OWN_TRIP)
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(newTraveler)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value("93541134780"))
                .andExpect(jsonPath("$.role").value("traveler"))
                .andExpect(jsonPath("$.firstLogin").value(true))
                .andExpect(jsonPath("$.password").doesNotExist());

        assertTrue(tripRepository.findById(OWN_TRIP).orElseThrow()
                .getTravelersJson().contains("93541134780"));
        assertTrue(paymentRepository.findFirstByUserCpfAndTripId("93541134780", OWN_TRIP)
                .isPresent());
    }

    @Test
    void adminCreatesAndUpdatesTripWithoutBypassingTravelerOperations() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        Trip created = trip("trip-new", "Nova viagem", "[\"" + OTHER_CPF + "\"]");

        mockMvc.perform(post("/trips")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(created)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("trip-new"))
                .andExpect(jsonPath("$.travelersJson").value("[]"));

        Trip update = trip(OWN_TRIP, "Viagem atualizada", "[]");
        mockMvc.perform(put("/trips/{id}", OWN_TRIP)
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Viagem atualizada"))
                .andExpect(jsonPath("$.travelersJson")
                        .value("[\"" + TRAVELER_CPF + "\",\"" + COMPANION_CPF + "\"]"));
    }

    @Test
    void invalidCpfIsRejectedWithUsefulJsonMessage() throws Exception {
        MockHttpSession session = login(ADMIN_CPF, "admin-secret");
        User invalid = user("11111111111", "CPF invalido", "temporary-secret", "traveler", true);

        mockMvc.perform(post("/users")
                        .session(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("CPF invalido."));
    }

    private MockHttpSession login(String cpf, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cpf":"%s","password":"%s"}
                                """.formatted(cpf, password)))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        return session;
    }

    private User user(String cpf, String name, String password, String role, boolean firstLogin) {
        return new User(
                cpf,
                name,
                password,
                role,
                "1990-05-12",
                firstLogin,
                false,
                "",
                false,
                new ArrayList<>()
        );
    }

    private Trip trip(String id, String name, String travelersJson) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setName(name);
        trip.setDestination("Destino");
        trip.setDeparturePlace("Origem");
        trip.setDepartureTime("08:00");
        trip.setDate(LocalDate.of(2027, 1, 20));
        trip.setMaxPeople(44);
        trip.setPrice(100.0);
        trip.setArrecadationGoal(4400.0);
        trip.setRules("");
        trip.setTravelersJson(travelersJson);
        trip.setBusesJson("[]");
        trip.setHotelsJson("[]");
        return trip;
    }

    private Payment payment(
            String id,
            String cpf,
            String tripId,
            int total,
            int paid,
            boolean locked,
            String receiptsJson
    ) {
        return new Payment(id, cpf, tripId, total, paid, 10, locked, receiptsJson);
    }
}
