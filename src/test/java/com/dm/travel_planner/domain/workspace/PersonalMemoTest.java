package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.global.storage.StoredFiles;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PersonalMemoTest {
    final WorkspaceRepository repository=mock(WorkspaceRepository.class);
    final WorkspaceService service=new WorkspaceService(repository,mock(WorkspacePreferencesRepository.class),mock(StoredFiles.class));
    WorkspaceService.Edit edit(String title,String parent,Long version) {
        return new WorkspaceService.Edit(title,"개인 메모",parent,null,null,false,0,"plain",Map.of("pinned",true),version);
    }
    @Test void memoNeedsNoLearningDateAndPreservesPinAndOwnership() {
        when(repository.saveAndFlush(any())).thenAnswer(i->{WorkspaceEntry e=i.getArgument(0);e.setVersion(0L);return e;});
        var created=service.create("owner",WorkspaceEntry.Kind.MEMO,edit("자유 메모",null,null));
        assertThat(created.startDate()).isNull();assertThat(created.details()).containsEntry("pinned",true);
        var e=new WorkspaceEntry();e.setId(created.id());e.setUserId("owner");e.setKind(WorkspaceEntry.Kind.MEMO);e.setVersion(0L);e.setCreatedAt(created.createdAt());
        when(repository.findByIdAndUserId(created.id(),"owner")).thenReturn(Optional.of(e));
        assertThat(service.update("owner",created.id(),edit("수정 메모",null,0L)).title()).isEqualTo("수정 메모");
        assertThatThrownBy(()->service.update("other",created.id(),edit("접근 시도",null,0L))).hasMessageContaining("404");
        assertThatThrownBy(()->service.update("owner",created.id(),edit("오래된 수정",null,5L))).hasMessageContaining("409");
    }
    @Test void memoCannotBeAttachedAsLearningChild() {
        var parent=new WorkspaceEntry();parent.setId("p");parent.setUserId("owner");parent.setKind(WorkspaceEntry.Kind.ROADMAP);
        when(repository.findByIdAndUserId("p","owner")).thenReturn(Optional.of(parent));
        assertThatThrownBy(()->service.create("owner",WorkspaceEntry.Kind.MEMO,edit("메모","p",null))).hasMessageContaining("400");
        verify(repository,never()).saveAndFlush(any());
    }
}
