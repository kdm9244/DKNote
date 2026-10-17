package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.global.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static com.dm.travel_planner.domain.travel.TravelRequests.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/travel")
public class PersonalTravelController {
    private final PersonalTravelService service;
    @GetMapping("/trips") public Object list(@AuthenticationPrincipal UserPrincipal u){return service.list(u.getUserId());}
    @PostMapping("/trips") public Object create(@Valid @RequestBody TripDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveTrip(null,r,u.getUserId());}
    @GetMapping("/trips/{id}") public Object detail(@PathVariable String id,@AuthenticationPrincipal UserPrincipal u){return service.detail(id,u.getUserId());}
    @PutMapping("/trips/{id}") public Object update(@PathVariable String id,@Valid @RequestBody TripDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveTrip(id,r,u.getUserId());}
    @DeleteMapping("/trips/{id}") public void deleteTrip(@PathVariable String id,@RequestParam int version,@AuthenticationPrincipal UserPrincipal u){service.deleteTrip(id,version,u.getUserId());}
    @PostMapping("/trips/{id}/legacy") public Object legacy(@PathVariable String id,@Valid @RequestBody LegacyDraft r,@AuthenticationPrincipal UserPrincipal u){return service.importLegacy(id,r,u.getUserId());}
    @PostMapping("/days/{day}/activities") public Object add(@PathVariable String day,@Valid @RequestBody ActivityDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveActivity(day,null,r,u.getUserId());}
    @PutMapping("/days/{day}/activities/{id}") public Object edit(@PathVariable String day,@PathVariable String id,@Valid @RequestBody ActivityDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveActivity(day,id,r,u.getUserId());}
    @PostMapping("/activities/{id}/move") public void move(@PathVariable String id,@Valid @RequestBody Move r,@AuthenticationPrincipal UserPrincipal u){service.move(id,r,u.getUserId());}
    @DeleteMapping("/activities/{id}") public void deleteActivity(@PathVariable String id,@RequestParam long version,@AuthenticationPrincipal UserPrincipal u){service.deleteActivity(id,version,u.getUserId());}
    @PostMapping("/trips/{trip}/places") public Object addPlace(@PathVariable String trip,@Valid @RequestBody PlaceDraft r,@AuthenticationPrincipal UserPrincipal u){return service.savePlace(trip,null,r,u.getUserId());}
    @PutMapping("/trips/{trip}/places/{id}") public Object editPlace(@PathVariable String trip,@PathVariable String id,@Valid @RequestBody PlaceDraft r,@AuthenticationPrincipal UserPrincipal u){return service.savePlace(trip,id,r,u.getUserId());}
    @DeleteMapping("/trips/{trip}/places/{id}") public void deletePlace(@PathVariable String trip,@PathVariable String id,@RequestParam long version,@AuthenticationPrincipal UserPrincipal u){service.deletePlace(trip,id,version,u.getUserId());}
    @PostMapping("/trips/{trip}/reservations") public Object addReservation(@PathVariable String trip,@Valid @RequestBody ReservationDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveReservation(trip,null,r,u.getUserId());}
    @PutMapping("/trips/{trip}/reservations/{id}") public Object editReservation(@PathVariable String trip,@PathVariable String id,@Valid @RequestBody ReservationDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveReservation(trip,id,r,u.getUserId());}
    @DeleteMapping("/trips/{trip}/reservations/{id}") public void deleteReservation(@PathVariable String trip,@PathVariable String id,@RequestParam long version,@AuthenticationPrincipal UserPrincipal u){service.deleteReservation(trip,id,version,u.getUserId());}
    @PostMapping("/trips/{trip}/expenses") public Object addExpense(@PathVariable String trip,@Valid @RequestBody ExpenseDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveExpense(trip,null,r,u.getUserId());}
    @PutMapping("/trips/{trip}/expenses/{id}") public Object editExpense(@PathVariable String trip,@PathVariable String id,@Valid @RequestBody ExpenseDraft r,@AuthenticationPrincipal UserPrincipal u){return service.saveExpense(trip,id,r,u.getUserId());}
    @DeleteMapping("/trips/{trip}/expenses/{id}") public void deleteExpense(@PathVariable String trip,@PathVariable String id,@RequestParam long version,@AuthenticationPrincipal UserPrincipal u){service.deleteExpense(trip,id,version,u.getUserId());}
}
