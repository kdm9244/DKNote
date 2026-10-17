package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.global.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.*;
import static com.dm.travel_planner.domain.workspace.WorkspaceEntry.Kind.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class WorkspaceIntegrationTest {
    @Autowired WorkspaceService service;
    @Autowired WorkspaceRepository repository;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider jwt;
    final ObjectMapper json=new ObjectMapper();
    final String owner="workspace_test_owner",other="workspace_test_other";
    LocalDate day(String s){return LocalDate.parse(s);}
    WorkspaceService.Edit edit(String title,String parent,String start,String end) {
        return new WorkspaceService.Edit(title,"내용",parent,start==null?null:day(start),end==null?null:day(end),false,0,"plain",Map.of(),null);
    }
    WorkspaceService.View roadmap(){return service.create(owner,ROADMAP,edit("학습 목표",null,"2026-10-01","2026-10-31"));}
    WorkspaceService.View milestone(String root){return service.create(owner,MILESTONE,edit("세부 목표",root,"2026-10-02","2026-10-25"));}
    WorkspaceService.View task(String root){return service.create(owner,TASK,edit("할 일",root,"2026-10-03","2026-10-20"));}
    String token(String uid){return jwt.createToken(uid,uid+"@example.test","USER");}
    @Test void privateEntriesCannotBeListedModifiedOrLinkedByAnotherUser() throws Exception {
        var entry=roadmap();assertTrue(service.list(other).isEmpty());
        mvc.perform(get("/api/workspace/entries").header("Authorization","Bearer "+token(other))).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(delete("/api/workspace/entries/"+entry.id()).header("Authorization","Bearer "+token(other))).andExpect(status().isNotFound());
        var badParent=edit("공유 불가",entry.id(),"2026-10-02","2026-10-20");
        assertEquals(404,assertThrows(ResponseStatusException.class,()->service.create(other,MILESTONE,badParent)).getStatusCode().value());
    }
    @Test void learningDatesStayInsideParentAndSchedulesRequireTasks() {
        var root=roadmap();var mile=milestone(root.id());var task=task(mile.id());
        assertEquals(400,assertThrows(ResponseStatusException.class,()->service.create(owner,SCHEDULE,edit("학습",task.id(),"2026-11-01",null))).getStatusCode().value());
    }
    @Test void shrinkingParentCannotExcludeExistingTasks() {
        var root=roadmap();var mile=milestone(root.id());task(mile.id());
        var shorter=new WorkspaceService.Edit(root.title(),root.body(),null,day("2026-10-01"),day("2026-10-05"),false,0,"plain",Map.of(),root.version());
        assertEquals(400,assertThrows(ResponseStatusException.class,()->service.update(owner,root.id(),shorter)).getStatusCode().value());
    }
    @Test void deletingRoadmapPreservesRecordsAndTheirCommentsWithoutDanglingParents() {
        var root=roadmap();var mile=milestone(root.id());var task=task(mile.id());
        var note=service.create(owner,RECORD,edit("보존할 필기",task.id(),"2026-10-11",null));
        var comment=service.create(owner,COMMENT,edit("코드 설명",note.id(),null,null));
        service.create(owner,SCHEDULE,edit("학습 일정",task.id(),"2026-10-11",null));
        service.delete(owner,root.id());repository.flush();
        assertNull(service.owned(owner,note.id()).getParentId());
        assertEquals(note.id(),service.owned(owner,comment.id()).getParentId());
        assertEquals(2,service.list(owner).size());
    }
    @Test void deletingOneTaskKeepsItsNoteAttachedToSurvivingMilestone() {
        var root=roadmap();var mile=milestone(root.id());var task=task(mile.id());
        var note=service.create(owner,RECORD,edit("필기",task.id(),"2026-10-11",null));
        service.delete(owner,task.id());assertEquals(mile.id(),service.owned(owner,note.id()).getParentId());
    }
    @Test void staleEditsReturnConflictInsteadOfOverwritingNewerData() throws Exception {
        var root=roadmap();var next=new WorkspaceService.Edit("변경",root.body(),null,root.startDate(),root.endDate(),false,0,"plain",Map.of(),root.version());
        service.update(owner,root.id(),next);
        mvc.perform(put("/api/workspace/entries/"+root.id()).header("Authorization","Bearer "+token(owner)).contentType("application/json")
            .content("{\"title\":\"낡은 변경\",\"startDate\":\"2026-10-01\",\"endDate\":\"2026-10-31\",\"version\":"+root.version()+"}")).andExpect(status().isConflict());
    }
    @Test void settingsArePrivateAndRejectInvalidCardOrder() throws Exception {
        service.settings(owner,Map.of("cards",List.of("learning","calendar"),"aiEnabled",false));assertTrue(service.settings(other).isEmpty());
        mvc.perform(patch("/api/workspace/settings").header("Authorization","Bearer "+token(owner)).contentType("application/json").content("{\"cards\":[\"calendar\",\"calendar\"]}")).andExpect(status().isBadRequest());
    }
    @Test void wordMasteryAppliesToAllMatchingSourcesOnlyForOwner() {
        var first=service.create(owner,WORD,new WorkspaceService.Edit("Spring", "뜻",null,null,null,false,0,"plain",Map.of("language","en"),null));
        var second=service.create(owner,WORD,new WorkspaceService.Edit("spring", "다른 뜻",null,null,null,false,0,"plain",Map.of("language","en"),null));
        var foreign=service.create(other,WORD,new WorkspaceService.Edit("spring", "뜻",null,null,null,false,0,"plain",Map.of("language","en"),null));
        service.wordMastery(owner,List.of(first.id()),true);
        assertTrue(service.owned(owner,second.id()).isCompleted());assertFalse(service.owned(other,foreign.id()).isCompleted());
    }
    @Test void calendarAndLearningApiRequireAuthentication() throws Exception {
        mvc.perform(get("/api/workspace/entries")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/calendar/google/calendars")).andExpect(status().isUnauthorized());
        mvc.perform(get("/calendar")).andExpect(status().isOk());
        mvc.perform(get("/learning/roadmaps/example")).andExpect(status().isOk());
    }
    @Test void invalidGoogleCallbackCannotAttachTokens() throws Exception {
        mvc.perform(get("/api/calendar/google/callback").param("state","unrecognized").param("code","fake")).andExpect(status().isBadRequest());
    }
    @Test void googleLoginRequestsCalendarAndRefreshTokenInOneFlow() throws Exception {
        String location=mvc.perform(get("/oauth2/authorization/google")).andExpect(status().is3xxRedirection()).andReturn().getResponse().getRedirectedUrl();
        String decoded=java.net.URLDecoder.decode(location,java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(decoded.contains(GoogleCalendarService.CALENDAR_EVENTS_SCOPE));
        assertTrue(decoded.contains(GoogleCalendarService.CALENDAR_LIST_SCOPE));
        assertTrue(decoded.contains("access_type=offline"));assertTrue(decoded.contains("prompt=consent"));
        String scopes=Arrays.stream(java.net.URI.create(location).getRawQuery().split("&")).filter(p->p.startsWith("scope=")).findFirst().map(p->java.net.URLDecoder.decode(p.substring(6),java.nio.charset.StandardCharsets.UTF_8)).orElse("");
        assertFalse(Arrays.asList(scopes.split(" ")).contains("openid"),"Keep the existing UserPrincipal OAuth2 flow");
    }
    @Test void profileOnlyTokensAreNotReportedAsCalendarPermission() {
        assertFalse(GoogleCalendarService.hasCalendarScopes("openid profile email"));
        assertTrue(GoogleCalendarService.hasCalendarScopes(GoogleCalendarService.CALENDAR_EVENTS_SCOPE+" "+GoogleCalendarService.CALENDAR_LIST_SCOPE));
    }
    @Test void pdfSplitPreferencesArePrivateAndValidated() throws Exception {
        service.settings(owner,Map.of("pdfNoteRatio",67.5,"pdfWordRatio",38));
        assertEquals(67.5,((Number)service.settings(owner).get("pdfNoteRatio")).doubleValue());assertTrue(service.settings(other).isEmpty());
        mvc.perform(patch("/api/workspace/settings").header("Authorization","Bearer "+token(owner)).contentType("application/json").content("{\"pdfNoteRatio\":99}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/workspace/settings").header("Authorization","Bearer "+token(owner)).contentType("application/json").content("{\"pdfWordRatio\":\"wide\"}")).andExpect(status().isBadRequest());
        assertEquals(67.5,((Number)service.settings(owner).get("pdfNoteRatio")).doubleValue());
    }
}
