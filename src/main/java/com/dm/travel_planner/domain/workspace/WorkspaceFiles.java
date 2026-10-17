package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.global.security.UserPrincipal;
import com.dm.travel_planner.global.storage.StoredFiles;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@RestController @RequestMapping("/api/workspace/pdf") @RequiredArgsConstructor
public class WorkspaceFiles {
    private final WorkspaceService service;
    private final WorkspaceRepository repository;
    private final StoredFiles storage;
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED) @Transactional(rollbackFor=Exception.class)
    public WorkspaceService.View upload(@AuthenticationPrincipal UserPrincipal principal,@RequestParam MultipartFile file,
            @RequestParam(required=false) String parentId) throws Exception {
        if(file.isEmpty() || file.getSize() > 20*1024*1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"PDF는 20MB 이하로 업로드하세요.");
        try(var in=file.getInputStream()) {
            if(!new String(in.readNBytes(5),StandardCharsets.US_ASCII).equals("%PDF-")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"PDF 파일만 업로드할 수 있습니다.");
        }
        if(parentId != null && !parentId.isBlank()) {
            var parent=service.owned(principal.getUserId(),parentId);
            if(!Set.of(WorkspaceEntry.Kind.ROADMAP,WorkspaceEntry.Kind.MILESTONE,WorkspaceEntry.Kind.TASK).contains(parent.getKind())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"학습 목표에 연결하세요.");
        }
        WorkspaceEntry entry=service.fresh(principal.getUserId(),WorkspaceEntry.Kind.PDF);
        String name=Optional.ofNullable(file.getOriginalFilename()).orElse("학습 자료.pdf").replaceAll("[\\\\/\r\n]","_");
        if(name.isBlank()) name="학습 자료.pdf";
        if(name.length()>180) name=name.substring(name.length()-180);
        entry.setTitle(name); entry.setParentId(parentId == null || parentId.isBlank() ? null : parentId);
        String reference=storage.upload(StoredFiles.Area.LEARNING,file);
        entry.setUpdatedAt(LocalDateTime.now()); entry.setDetails(service.write(Map.of("fileKey",reference,"fileName",name,"fileSize",file.getSize(),"pages",Map.of())));
        return service.view(repository.saveAndFlush(entry));
    }
    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> file(@AuthenticationPrincipal UserPrincipal p,@PathVariable String id) throws Exception {
        var entry=service.owned(p.getUserId(),id);
        if(entry.getKind()!=WorkspaceEntry.Kind.PDF) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        String reference=String.valueOf(service.read(entry.getDetails()).getOrDefault("fileKey",entry.getId()+".pdf"));
        Resource resource=storage.resource(StoredFiles.Area.LEARNING,reference);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).contentLength(resource.contentLength())
            .header(HttpHeaders.CACHE_CONTROL,"private, no-store")
            .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(entry.getTitle(),StandardCharsets.UTF_8).build().toString())
            .body(resource);
    }
}
