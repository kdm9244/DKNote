package com.dm.travel_planner.domain.notice;
import com.dm.travel_planner.domain.user.entity.*;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReleaseNoticeServiceTest {
    @Mock ReleaseNoticeRepository notices;
    @Mock UserRepository users;
    @InjectMocks ReleaseNoticeService service;
    @Test void publicReadingDoesNotRequireAnAccountOrExposeAuthorAndRevision(){
        var n=new ReleaseNotice();n.setId("notice");n.setTitle("업데이트");n.setReleaseVersion("1.1");n.setBody("PDF 글자 선택\n표 편집 개선");n.setAuthorId("private-author");n.setVersion(7L);n.setCreatedAt(LocalDateTime.of(2026,10,19,12,0));
        when(notices.findTop5ByOrderByCreatedAtDesc()).thenReturn(List.of(n));
        var result=service.publicNotices();assertThat(result).hasSize(1);assertThat(result.getFirst().body()).contains("표 편집");
        assertThat(Arrays.stream(ReleaseNoticeService.PublicNotice.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName)).doesNotContain("authorId","version","canPublish","canManage");
        verifyNoInteractions(users);
    }
    @Test void publisherCanPostButCannotEditOrDelete(){
        when(users.findById("publisher")).thenReturn(Optional.of(User.builder().role(UserRole.NOTICE_PUBLISHER).build()));
        when(notices.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));
        assertThat(service.save("publisher",null,new ReleaseNoticeService.Edit("공지","1.0","내용",null)).title()).isEqualTo("공지");
        assertThatThrownBy(()->service.save("publisher","id",new ReleaseNoticeService.Edit("공지","1.1","내용",0L))).hasMessageContaining("403");
        assertThatThrownBy(()->service.delete("publisher","id",0L)).hasMessageContaining("403");
    }
    @Test void normalUsersCannotCreateOrDelete(){
        when(users.findById("user")).thenReturn(Optional.of(User.builder().role(UserRole.USER).build()));
        assertThatThrownBy(()->service.save("user",null,new ReleaseNoticeService.Edit("제목","1.0","내용",null))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        assertThatThrownBy(()->service.delete("user","id",0L)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        verifyNoInteractions(notices);
    }
    @Test void adminCanPublishAndEditWithCurrentVersion(){
        when(users.findById("admin")).thenReturn(Optional.of(User.builder().role(UserRole.ADMIN).build()));
        when(notices.saveAndFlush(any())).thenAnswer(i->{ReleaseNotice n=i.getArgument(0);n.setVersion(n.getVersion()==null?0L:n.getVersion()+1);return n;});
        var result=service.save("admin",null,new ReleaseNoticeService.Edit(" 제목 ","1.0","내용",null));
        assertThat(result.title()).isEqualTo("제목");assertThat(result.version()).isZero();
        var n=new ReleaseNotice();n.setId(result.id());n.setVersion(0L);n.setCreatedAt(LocalDateTime.now());when(notices.findById(n.getId())).thenReturn(Optional.of(n));
        assertThat(service.save("admin",n.getId(),new ReleaseNoticeService.Edit("수정","1.1","새 내용",0L)).version()).isEqualTo(1L);
        assertThatThrownBy(()->service.save("admin",n.getId(),new ReleaseNoticeService.Edit("오래된 수정","1.1","내용",0L))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThatThrownBy(()->service.delete("admin",n.getId(),0L)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    }
    @Test void loggedInUsersCanReadWithoutAdminControls(){
        when(users.findById("user")).thenReturn(Optional.of(User.builder().role(UserRole.USER).build()));
        when(notices.findTop100ByOrderByCreatedAtDesc()).thenReturn(List.of());
        assertThat(service.list("user").canManage()).isFalse();
    }
}
