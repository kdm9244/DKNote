package com.dm.travel_planner.domain.notice;
import com.dm.travel_planner.global.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController @RequestMapping("/api/notices") @RequiredArgsConstructor
public class ReleaseNoticeController {
    private final ReleaseNoticeService service;
    @GetMapping("/public") public java.util.List<ReleaseNoticeService.PublicNotice> publicList(){return service.publicNotices();}
    @GetMapping public ReleaseNoticeService.Listing list(@AuthenticationPrincipal UserPrincipal p){return service.list(p.getUserId());}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ReleaseNoticeService.View create(@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody ReleaseNoticeService.Edit input){return service.save(p.getUserId(),null,input);}
    @PutMapping("/{id}") public ReleaseNoticeService.View update(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id,@Valid @RequestBody ReleaseNoticeService.Edit input){return service.save(p.getUserId(),id,input);}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id,@RequestParam Long version){service.delete(p.getUserId(),id,version);}
}
