package com.dm.travel_planner.domain.workspace;
import com.dm.travel_planner.global.security.UserPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import lombok.RequiredArgsConstructor;
import java.time.LocalDate;
import java.net.URI;
import java.util.*;

@RestController @RequestMapping("/api/calendar/google") @RequiredArgsConstructor
public class GoogleCalendarController {
    private final GoogleCalendarService service;
    private final com.dm.travel_planner.global.config.ApplicationOrigins origins;
    @GetMapping("/status") public Map<String,Object> status(@AuthenticationPrincipal UserPrincipal p){return service.status(p.getUserId());}
    @PostMapping("/connect") public Map<String,Object> connect(@AuthenticationPrincipal UserPrincipal p,@RequestBody Map<String,String> input) throws Exception {
        String callback=origins.publicUrl().isEmpty()
                ? ServletUriComponentsBuilder.fromCurrentContextPath().path("/api/calendar/google/callback").build().toUriString()
                : origins.publicUrl()+"/api/calendar/google/callback";
        return service.connect(p.getUserId(),callback,input.getOrDefault("origin",origins.publicUrl().isEmpty()?"https://dknote.tech":origins.publicUrl()));
    }
    @GetMapping("/callback") public ResponseEntity<Void> callback(@RequestParam(required=false) String state,@RequestParam(required=false) String code,@RequestParam(required=false) String error) throws Exception {
        return ResponseEntity.status(302).location(URI.create(service.callback(state,code,error))).header("Referrer-Policy","no-referrer").build();
    }
    @DeleteMapping("/connect") @ResponseStatus(HttpStatus.NO_CONTENT) public void disconnect(@AuthenticationPrincipal UserPrincipal p){service.disconnect(p.getUserId());}
    @GetMapping("/calendars") public List<Map<String,Object>> calendars(@AuthenticationPrincipal UserPrincipal p) throws Exception{return service.calendars(p.getUserId());}
    @GetMapping("/events") public List<Map<String,Object>> events(@AuthenticationPrincipal UserPrincipal p,@RequestParam String calendarId,@RequestParam LocalDate start,@RequestParam LocalDate end) throws Exception{return service.events(p.getUserId(),calendarId,start,end);}
    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> create(@AuthenticationPrincipal UserPrincipal p,@RequestParam String calendarId,@RequestBody Map<String,Object> input) throws Exception{return service.saveEvent(p.getUserId(),calendarId,null,input);}
    @PatchMapping("/events/{id}") public Map<String,Object> update(@AuthenticationPrincipal UserPrincipal p,@RequestParam String calendarId,@PathVariable String id,@RequestBody Map<String,Object> input) throws Exception{return service.saveEvent(p.getUserId(),calendarId,id,input);}
    @DeleteMapping("/events/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal UserPrincipal p,@RequestParam String calendarId,@PathVariable String id,@RequestParam(required=false) String etag) throws Exception {service.deleteEvent(p.getUserId(),calendarId,id,etag);}
}
