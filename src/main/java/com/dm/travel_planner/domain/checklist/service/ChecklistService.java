package com.dm.travel_planner.domain.checklist.service;

import com.dm.travel_planner.domain.checklist.dto.ChecklistItemCreateRequest;
import com.dm.travel_planner.domain.checklist.dto.ChecklistAttachmentResponse;
import com.dm.travel_planner.domain.checklist.dto.ChecklistAttachmentDownload;
import com.dm.travel_planner.domain.checklist.dto.ChecklistItemResponse;
import com.dm.travel_planner.domain.checklist.dto.ChecklistItemUpdateRequest;
import com.dm.travel_planner.domain.checklist.entity.ChecklistItem;
import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachment;
import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachmentScope;
import com.dm.travel_planner.domain.checklist.entity.ChecklistScope;
import com.dm.travel_planner.domain.checklist.repository.ChecklistItemRepository;
import com.dm.travel_planner.domain.checklist.repository.ChecklistAttachmentRepository;
import com.dm.travel_planner.domain.trip.entity.Trip;
import com.dm.travel_planner.domain.trip.repository.TripRepository;
import com.dm.travel_planner.domain.user.entity.User;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.storage.StoredFiles;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChecklistService {

    private final ChecklistItemRepository checklistItemRepository;
    private final ChecklistAttachmentRepository checklistAttachmentRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final StoredFiles storage;

    @Transactional(readOnly = true)
    public List<ChecklistItemResponse> getChecklist(String tripId, String scopeFilter, String currentUserId) {
        Trip trip = requireTrip(tripId);
        requireTripMember(trip, currentUserId);

        String normalizedFilter = scopeFilter == null ? "ALL" : scopeFilter.trim().toUpperCase();
        List<ChecklistItem> items = switch (normalizedFilter) {
            case "ALL" -> checklistItemRepository.findVisibleItems(tripId, currentUserId);
            case "SHARED" -> checklistItemRepository.findByScopeForUser(tripId, ChecklistScope.SHARED, currentUserId);
            case "PERSONAL" -> checklistItemRepository.findByScopeForUser(tripId, ChecklistScope.PERSONAL, currentUserId);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope는 ALL, SHARED, PERSONAL 중 하나여야 합니다.");
        };

        return items.stream().map(item -> mapToResponse(item, currentUserId)).toList();
    }

    @Transactional
    public ChecklistItemResponse createItem(
            String tripId,
            ChecklistItemCreateRequest request,
            String currentUserId) {
        Trip trip = requireTrip(tripId);
        requireTripMember(trip, currentUserId);
        User currentUser = requireUser(currentUserId);
        ChecklistScope scope = ChecklistScope.PERSONAL;


        ChecklistItem item = ChecklistItem.builder()
                .trip(trip)
                .category(request.getCategory())
                .title(request.getTitle())
                .scope(scope)
                .owner(scope == ChecklistScope.PERSONAL ? currentUser : null)
                .createdBy(currentUser)
                .linkUrl(request.getLinkUrl())
                .memo(request.getMemo())
                .isChecked(false)
                .build();

        return mapToResponse(checklistItemRepository.save(item), currentUserId);
    }

    @Transactional
    public ChecklistItemResponse updateItem(
            String itemId,
            ChecklistItemUpdateRequest request,
            String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        if (!canManage(item, currentUserId)) {
            throw forbidden("이 준비물을 수정할 권한이 없습니다.");
        }

        if (request.getCategory() != null) item.setCategory(request.getCategory());
        if (request.getTitle() != null) item.setTitle(request.getTitle());
        if (request.getIsChecked() != null) item.setChecked(request.getIsChecked());
        if (request.getLinkUrl() != null) item.setLinkUrl(request.getLinkUrl());
        if (request.getMemo() != null) item.setMemo(request.getMemo());

        ChecklistScope currentScope = effectiveScope(item);
        ChecklistScope nextScope = ChecklistScope.PERSONAL;
        if (nextScope != currentScope) {
            if (nextScope == ChecklistScope.PERSONAL) {
                item.setScope(ChecklistScope.PERSONAL);
                item.setOwner(requireUser(currentUserId));
            } else {
                item.setScope(ChecklistScope.SHARED);
                item.setOwner(null);
            }
        }

        return mapToResponse(checklistItemRepository.save(item), currentUserId);
    }

    @Transactional
    public ChecklistItemResponse toggleItem(String itemId, String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        if (!canToggle(item, currentUserId)) {
            throw forbidden("이 준비물의 체크 상태를 변경할 권한이 없습니다.");
        }
        item.setChecked(!item.isChecked());
        return mapToResponse(checklistItemRepository.save(item), currentUserId);
    }

    @Transactional
    public void deleteItem(String itemId, String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        if (!canManage(item, currentUserId)) {
            throw forbidden("이 준비물을 삭제할 권한이 없습니다.");
        }
        List<ChecklistAttachment> attachments =
                checklistAttachmentRepository.findByChecklistItem_ItemIdOrderByCreatedAtAsc(itemId);
        attachments.forEach(attachment -> deleteStoredFileAfterCommit(attachment.getFileUrl()));
        checklistAttachmentRepository.deleteAll(attachments);
        checklistItemRepository.delete(item);
    }

    @Transactional
    public ChecklistItemResponse uploadFiles(
            String itemId,
            List<MultipartFile> files,
            ChecklistAttachmentScope attachmentScope,
            String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        User currentUser = requireUser(currentUserId);
        ChecklistAttachmentScope normalizedScope = attachmentScope == null
                ? ChecklistAttachmentScope.PERSONAL
                : attachmentScope;
        if (files == null || files.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드할 파일을 선택해 주세요.");
        }
        List<MultipartFile> validFiles = files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
        if (validFiles.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드할 파일이 비어 있습니다.");
        }
        int existingAttachmentCount =
                checklistAttachmentRepository
                        .findByChecklistItem_ItemIdAndUploadedBy_UserIdOrderByCreatedAtAsc(
                                itemId,
                                currentUserId)
                        .size();
        if (existingAttachmentCount + validFiles.size() > 10) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "준비물 하나에는 최대 10개 파일까지 첨부할 수 있습니다.");
        }

        {
            List<ChecklistAttachment> savedAttachments = new ArrayList<>();
            for (MultipartFile file : validFiles) {
                String originalFilename = file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename();
                String safeFilename = originalFilename.replaceAll("[\\\\/\\p{Cntrl}]", "_");
                if (safeFilename.isBlank()) safeFilename="attachment";
                if (safeFilename.length()>255) safeFilename=safeFilename.substring(safeFilename.length()-255);
                String reference=storage.upload(StoredFiles.Area.CHECKLIST,file);
                savedAttachments.add(ChecklistAttachment.builder()
                        .checklistItem(item)
                        .uploadedBy(currentUser)
                        .scope(normalizedScope)
                        .fileUrl(reference)
                        .fileName(safeFilename)
                        .contentType(file.getContentType())
                        .fileSize(file.getSize())
                        .build());
            }
            checklistAttachmentRepository.saveAll(savedAttachments);
            return mapToResponse(item, currentUserId);
        }
    }

    @Transactional
    public ChecklistItemResponse deleteAttachment(
            String itemId,
            String attachmentId,
            String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        ChecklistAttachment attachment = checklistAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다."));
        if (!attachment.getChecklistItem().getItemId().equals(itemId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다.");
        }
        requireAttachmentOwner(attachment, item, currentUserId);
        deleteStoredFileAfterCommit(attachment.getFileUrl());
        checklistAttachmentRepository.delete(attachment);
        checklistAttachmentRepository.flush();
        return mapToResponse(item, currentUserId);
    }

    @Transactional(readOnly = true)
    public ChecklistAttachmentDownload downloadAttachment(
            String itemId,
            String attachmentId,
            String currentUserId) {
        ChecklistItem item = requireVisibleItem(itemId, currentUserId);
        ChecklistAttachment attachment = checklistAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다."));
        if (!attachment.getChecklistItem().getItemId().equals(itemId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다.");
        }
        if (!canViewAttachment(attachment, item, currentUserId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다.");
        }

        return new ChecklistAttachmentDownload(
                storage.resource(StoredFiles.Area.CHECKLIST,attachment.getFileUrl()),
                attachment.getFileName(),
                attachment.getContentType());
    }

    private ChecklistItem requireVisibleItem(String itemId, String currentUserId) {
        ChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "준비물을 찾을 수 없습니다."));
        requireTripMember(item.getTrip(), currentUserId);
        if (effectiveScope(item) == ChecklistScope.PERSONAL
                && (item.getOwner() == null || !item.getOwner().getUserId().equals(currentUserId))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "준비물을 찾을 수 없습니다.");
        }
        return item;
    }

    private Trip requireTrip(String tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "여행을 찾을 수 없습니다."));
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 사용자를 찾을 수 없습니다."));
    }

    private void requireTripMember(Trip trip, String userId) {
        if (!isTripOwner(trip, userId)) {
            throw forbidden("이 여행의 체크리스트에 접근할 수 없습니다.");
        }
    }

    private boolean canManage(ChecklistItem item, String userId) {
        if (effectiveScope(item) == ChecklistScope.PERSONAL) {
            return item.getOwner() != null && item.getOwner().getUserId().equals(userId);
        }
        return isTripOwner(item.getTrip(), userId)
                || (item.getCreatedBy() != null && item.getCreatedBy().getUserId().equals(userId));
    }

    private boolean canToggle(ChecklistItem item, String userId) {
        if (effectiveScope(item) == ChecklistScope.PERSONAL) {
            return item.getOwner() != null && item.getOwner().getUserId().equals(userId);
        }
        return true;
    }

    private void requireAttachmentOwner(
            ChecklistAttachment attachment,
            ChecklistItem item,
            String currentUserId) {
        if (attachment.getUploadedBy() != null
                && attachment.getUploadedBy().getUserId().equals(currentUserId)) {
            return;
        }
        if (attachment.getUploadedBy() == null && canManage(item, currentUserId)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부파일을 찾을 수 없습니다.");
    }

    private boolean canViewAttachment(ChecklistAttachment attachment, ChecklistItem item, String currentUserId) {
        if (attachment.getUploadedBy() == null) {
            return canManage(item, currentUserId);
        }
        ChecklistAttachmentScope attachmentScope = attachment.getScope() == null
                ? ChecklistAttachmentScope.PERSONAL
                : attachment.getScope();
        return attachmentScope == ChecklistAttachmentScope.SHARED
                || attachment.getUploadedBy().getUserId().equals(currentUserId);
    }

    private List<ChecklistAttachment> visibleAttachments(ChecklistItem item, String currentUserId) {
        return checklistAttachmentRepository
                .findByChecklistItem_ItemIdOrderByCreatedAtAsc(item.getItemId()).stream()
                .filter(attachment -> canViewAttachment(attachment, item, currentUserId))
                .toList();
    }

    private boolean isTripOwner(Trip trip, String userId) {
        return userId != null && userId.equals(trip.getOwnerId());
    }

    private ChecklistScope effectiveScope(ChecklistItem item) {
        return item.getScope() == null ? ChecklistScope.SHARED : item.getScope();
    }

    private ChecklistItemResponse mapToResponse(ChecklistItem item, String currentUserId) {
        boolean editable = canManage(item, currentUserId);
        List<ChecklistAttachmentResponse> attachments =
                visibleAttachments(item, currentUserId).stream()
                        .map(attachment -> ChecklistAttachmentResponse.builder()
                                .attachmentId(attachment.getAttachmentId())
                                .fileUrl("/api/checklist/" + item.getItemId()
                                        + "/attachments/" + attachment.getAttachmentId() + "/download")
                                .fileName(attachment.getFileName())
                                .contentType(attachment.getContentType())
                                .fileSize(attachment.getFileSize())
                                .createdAt(attachment.getCreatedAt())
                                .scope(attachment.getScope() == null
                                        ? ChecklistAttachmentScope.PERSONAL
                                        : attachment.getScope())
                                .uploadedByName(attachment.getUploadedBy() == null
                                        ? null
                                        : attachment.getUploadedBy().getNickname())
                                .deletable((attachment.getUploadedBy() != null
                                        && attachment.getUploadedBy().getUserId().equals(currentUserId))
                                        || (attachment.getUploadedBy() == null && canManage(item, currentUserId)))
                                .build())
                        .toList();
        return ChecklistItemResponse.builder()
                .itemId(item.getItemId())
                .tripId(item.getTrip().getTripId())
                .category(item.getCategory())
                .title(item.getTitle())
                .isChecked(item.isChecked())
                .scope(effectiveScope(item))
                .ownerId(item.getOwner() == null ? null : item.getOwner().getUserId())
                .ownerName(item.getOwner() == null ? null : item.getOwner().getNickname())
                .createdById(item.getCreatedBy() == null ? null : item.getCreatedBy().getUserId())
                .createdByName(item.getCreatedBy() == null ? null : item.getCreatedBy().getNickname())
                .attachments(attachments)
                .linkUrl(item.getLinkUrl())
                .memo(item.getMemo())
                .sequence(item.getSequence())
                .createdAt(item.getCreatedAt())
                .editable(editable)
                .deletable(editable)
                .toggleable(canToggle(item, currentUserId))
                .attachmentEditable(true)
                .build();
    }

    private void deleteStoredFileAfterCommit(String fileUrl) {
        storage.deleteAfterCommit(StoredFiles.Area.CHECKLIST,fileUrl);
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

}
