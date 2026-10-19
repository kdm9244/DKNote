package com.dm.travel_planner.domain.notice;

import com.dm.travel_planner.domain.user.entity.UserRole;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class ReleaseNoticeService {
    private final ReleaseNoticeRepository notices;
    private final UserRepository users;
    public record Edit(@NotBlank @Size(max=200) String title,@NotBlank @Size(max=40) String releaseVersion,@NotBlank @Size(max=20000) String body,Long version) {}
    public record View(String id,String title,String releaseVersion,String body,LocalDateTime createdAt,LocalDateTime updatedAt,Long version) {
        static View from(ReleaseNotice n){return new View(n.getId(),n.getTitle(),n.getReleaseVersion(),n.getBody(),n.getCreatedAt(),n.getUpdatedAt(),n.getVersion());}
    }
    public record Listing(boolean canManage,boolean canPublish,List<View> notices) {}
    public record PublicNotice(String id,String title,String releaseVersion,String body,LocalDateTime createdAt) {}
    public List<PublicNotice> publicNotices(){return notices.findTop5ByOrderByCreatedAtDesc().stream().map(n->new PublicNotice(n.getId(),n.getTitle(),n.getReleaseVersion(),n.getBody(),n.getCreatedAt())).toList();}
    public boolean canManage(String userId){return users.findById(userId).map(u->u.getRole()==UserRole.ADMIN).orElse(false);}
    private void requireAdmin(String userId){if(!canManage(userId))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"관리자만 공지를 관리할 수 있습니다.");}
    private boolean canPublish(String userId){return users.findById(userId).map(u->u.getRole()==UserRole.ADMIN||u.getRole()==UserRole.NOTICE_PUBLISHER).orElse(false);}
    public Listing list(String userId){return new Listing(canManage(userId),canPublish(userId),notices.findTop100ByOrderByCreatedAtDesc().stream().map(View::from).toList());}
    @Transactional public View save(String userId,String id,Edit input){
        if(id==null){if(!canPublish(userId))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"공지 등록 권한이 없습니다.");}else requireAdmin(userId);
        ReleaseNotice notice;
        if(id==null){notice=new ReleaseNotice();notice.setId(UUID.randomUUID().toString());notice.setAuthorId(userId);notice.setCreatedAt(LocalDateTime.now());}
        else {notice=notices.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"공지를 찾을 수 없습니다."));if(input.version()==null||!input.version().equals(notice.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 곳에서 수정되었습니다. 새로고침 후 다시 시도하세요.");}
        notice.setTitle(input.title().trim());notice.setReleaseVersion(input.releaseVersion().trim());notice.setBody(input.body().trim());notice.setUpdatedAt(LocalDateTime.now());
        return View.from(notices.saveAndFlush(notice));
    }
    @Transactional public void delete(String userId,String id,Long version){requireAdmin(userId);var notice=notices.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"공지를 찾을 수 없습니다."));if(!Objects.equals(version,notice.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"공지가 변경되었습니다. 새로고침 후 다시 시도하세요.");notices.delete(notice);}
}
