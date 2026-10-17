package com.dm.travel_planner.domain.checklist.controller;

import com.dm.travel_planner.domain.checklist.dto.ChecklistItemCreateRequest;
import com.dm.travel_planner.domain.checklist.dto.ChecklistAttachmentDownload;
import com.dm.travel_planner.domain.checklist.dto.ChecklistItemResponse;
import com.dm.travel_planner.domain.checklist.dto.ChecklistItemUpdateRequest;
import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachmentScope;
import com.dm.travel_planner.domain.checklist.service.ChecklistService;
import com.dm.travel_planner.global.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.nio.charset.StandardCharsets;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class ChecklistController {

    private final ChecklistService checklistService;

    private String extractUserId(UserPrincipal principal) {
        if (principal == null || principal.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return principal.getUserId();
    }

    @GetMapping("/trips/{tripId}/checklist")
    public ResponseEntity<List<ChecklistItemResponse>> getChecklist(
            @PathVariable String tripId,
            @RequestParam(defaultValue = "ALL") String scope,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.getChecklist(tripId, scope, extractUserId(principal)));
    }

    @PostMapping("/trips/{tripId}/checklist")
    public ResponseEntity<ChecklistItemResponse> createItem(
            @PathVariable String tripId,
            @RequestBody @Valid ChecklistItemCreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.createItem(tripId, request, extractUserId(principal)));
    }

    @PutMapping("/checklist/{itemId}")
    public ResponseEntity<ChecklistItemResponse> updateItem(
            @PathVariable String itemId,
            @RequestBody ChecklistItemUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.updateItem(itemId, request, extractUserId(principal)));
    }

    @PatchMapping("/checklist/{itemId}/toggle")
    public ResponseEntity<ChecklistItemResponse> toggleItem(
            @PathVariable String itemId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.toggleItem(itemId, extractUserId(principal)));
    }

    @DeleteMapping("/checklist/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable String itemId,
            @AuthenticationPrincipal UserPrincipal principal) {
        checklistService.deleteItem(itemId, extractUserId(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/checklist/{itemId}/attachments")
    public ResponseEntity<ChecklistItemResponse> uploadAttachments(
            @PathVariable String itemId,
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(defaultValue = "PERSONAL") ChecklistAttachmentScope scope,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.uploadFiles(itemId, files, scope, extractUserId(principal)));
    }

    @DeleteMapping("/checklist/{itemId}/attachments/{attachmentId}")
    public ResponseEntity<ChecklistItemResponse> deleteAttachment(
            @PathVariable String itemId,
            @PathVariable String attachmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(checklistService.deleteAttachment(itemId, attachmentId, extractUserId(principal)));
    }

    @GetMapping("/checklist/{itemId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable String itemId,
            @PathVariable String attachmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        ChecklistAttachmentDownload download =
                checklistService.downloadAttachment(itemId, attachmentId, extractUserId(principal));
        MediaType mediaType;
        try {
            mediaType = download.contentType() == null
                    ? MediaType.APPLICATION_OCTET_STREAM
                    : MediaType.parseMediaType(download.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        String disposition = ContentDisposition.attachment()
                .filename(download.fileName(), StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(download.resource());
    }
}
