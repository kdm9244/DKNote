package com.dm.travel_planner.domain.workspace;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc @Transactional
class WorkspaceEditingTest {
    @Autowired WorkspaceService service;@Autowired WorkspaceRepository entries;@Autowired MockMvc mvc;@Autowired JwtTokenProvider jwt;
    final String uid="editing-test-owner";
    String token(){return jwt.createToken(uid,"editing@example.test","USER");}
    WorkspaceEntry pdf(){var e=service.fresh(uid,WorkspaceEntry.Kind.PDF);e.setTitle("test.pdf");e.setUpdatedAt(java.time.LocalDateTime.now());e.setBody("");e.setFormat("plain");e.setDetails("{\"fileKey\":\"test.pdf\",\"pages\":{}}");return entries.saveAndFlush(e);}
    @Test void pdfPagesSaveIndependentlyAndRejectStaleSamePageOrOtherUser(){
        var pdf=pdf();service.savePdfPage(uid,pdf.getId(),1,new WorkspaceService.PdfNoteEdit("first","plain",null,null));service.savePdfPage(uid,pdf.getId(),2,new WorkspaceService.PdfNoteEdit("second","plain",null,null));
        var pages=(Map<?,?>)service.view(service.owned(uid,pdf.getId())).details().get("pages");assertEquals(2,pages.size());
        assertEquals(409,assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.savePdfPage(uid,pdf.getId(),1,new WorkspaceService.PdfNoteEdit("stale","plain",null,null))).getStatusCode().value());
        assertEquals(404,assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.savePdfPage("other",pdf.getId(),1,new WorkspaceService.PdfNoteEdit("steal","plain","first","plain"))).getStatusCode().value());
    }
    @Test void wordImportSkipsExactDuplicatesSupportsEmptyMeaningsAndRejectsForeignPdf(){
        var p=pdf();String request=UUID.randomUUID().toString();var rows=List.of(new WorkspaceService.WordRow("可用性","かようせい","가용성"),new WorkspaceService.WordRow("冗長化","",""),new WorkspaceService.WordRow("可用性","かようせい","가용성"));
        var batch=new WorkspaceService.WordImport(request,p.getId(),1,"ja",rows);assertEquals(2,service.importWords(uid,batch).size());assertTrue(service.importWords(uid,batch).isEmpty());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.importWords("other",batch));
    }
    @Test void richTextKeepsFormattingButRemovesScriptsHandlersAndRemoteContent(){
        String safe=RichTextSanitizer.clean("<p><strong>keep</strong><span style='color:#315cbb;position:fixed'>blue</span><img src=x onerror=alert(1)><script>alert(1)</script><iframe src='https://evil.test'></iframe></p>");
        assertTrue(safe.contains("<strong>keep</strong>"));assertTrue(safe.contains("color:#315cbb"));assertFalse(safe.contains("script"));assertFalse(safe.contains("onerror"));assertFalse(safe.contains("iframe"));assertFalse(safe.contains("position"));
    }
    @Test void aiConfigNeverReturnsSecretAndAnonymousCannotUseAiOrImages() throws Exception {
        mvc.perform(get("/api/ai/config")).andExpect(status().isUnauthorized());mvc.perform(get("/api/feeds/files/unknown.png")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ai/config").header("Authorization","Bearer "+token())).andExpect(status().isOk()).andExpect(jsonPath("$.geminiApiKey").doesNotExist()).andExpect(jsonPath("$.hasGeminiEnv").isBoolean());
        mvc.perform(post("/api/ai/gemini/chat").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
    }
    @Test void personalServerDisablesNewSignupByDefault() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{\"email\":\"not-allowed@example.test\",\"password\":\"safe-password\",\"nickname\":\"Blocked\"}")).andExpect(status().isForbidden());
    }
}

