package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.global.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@RestController @RequestMapping("/api/workspace") @RequiredArgsConstructor
public class WorkspaceController {
    private final WorkspaceService service;
    @PostMapping("/words/import") public List<WorkspaceService.View> importWords(@AuthenticationPrincipal UserPrincipal p,@RequestBody WorkspaceService.WordImport input){return service.importWords(p.getUserId(),input);}
    @PutMapping("/pdf/{id}/pages/{page}") public WorkspaceService.View pageNote(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id,@PathVariable int page,@RequestBody WorkspaceService.PdfNoteEdit note){return service.savePdfPage(p.getUserId(),id,page,note);}
    @GetMapping("/entries") public List<WorkspaceService.View> list(@AuthenticationPrincipal UserPrincipal p) {return service.list(p.getUserId());}
    @PutMapping("/order") public List<WorkspaceService.View> reorder(@AuthenticationPrincipal UserPrincipal p,@RequestBody List<WorkspaceService.Order> input){return service.reorder(p.getUserId(),input);}
    public record Mastery(List<String> ids,boolean completed) {}
    @PatchMapping("/words/mastery") public List<WorkspaceService.View> mastery(@AuthenticationPrincipal UserPrincipal p,@RequestBody Mastery input){if(input.ids()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"단어 목록이 필요합니다.");return service.wordMastery(p.getUserId(),input.ids(),input.completed());}
    @PostMapping("/entries/{kind}") @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceService.View create(@AuthenticationPrincipal UserPrincipal p,@PathVariable WorkspaceEntry.Kind kind,@RequestBody WorkspaceService.Edit edit) {return service.create(p.getUserId(),kind,edit);}
    @PutMapping("/entries/{id}") public WorkspaceService.View update(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id,@RequestBody WorkspaceService.Edit edit) {return service.update(p.getUserId(),id,edit);}
    @DeleteMapping("/entries/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id) {service.delete(p.getUserId(),id);}
    @GetMapping("/settings") public Map<String,Object> settings(@AuthenticationPrincipal UserPrincipal p) {return service.settings(p.getUserId());}
    @PatchMapping("/settings") public Map<String,Object> settings(@AuthenticationPrincipal UserPrincipal p,@RequestBody Map<String,Object> edit) {return service.settings(p.getUserId(),edit);}
}
