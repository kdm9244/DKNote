package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.domain.user.entity.*;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named="workspace.browser.test",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"market-data.sync-initial-delay-ms=3600000","app.upload.learning-dir=./.local/workspace-browser-files"})
class WorkspaceBrowserTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired WorkspaceRepository entries;
    @Autowired WorkspacePreferencesRepository preferences;
    @Autowired JwtTokenProvider jwt;
    @Autowired PlatformTransactionManager manager;
    String uid;
    @Test void browserExercisesNewFeaturesWithIsolatedTemporaryUser() throws Exception {
        uid="qa_"+UUID.randomUUID().toString().replace("-","");
        users.saveAndFlush(User.builder().userId(uid).email(uid+"@example.test").nickname("화면 검증").provider(AuthProvider.LOCAL).role(UserRole.USER).build());
        ProcessBuilder builder=new ProcessBuilder("C:\\Program Files\\nodejs\\node.exe","tests/workspace-smoke.mjs").directory(Path.of(System.getProperty("workspace.frontend.dir","frontend")).toFile()).redirectErrorStream(true);
        builder.environment().put("WORKSPACE_TEST_URL","http://localhost:"+port);
        builder.environment().put("WORKSPACE_TEST_TOKEN",jwt.createToken(uid,uid+"@example.test","USER"));
        Path output=Path.of(".local/workspace-browser.log");builder.redirectOutput(output.toFile());
        Process process=builder.start();
        if(!process.waitFor(150,TimeUnit.SECONDS)){process.destroyForcibly();fail("Browser test timed out; see .local/workspace-browser.log");}
        assertEquals(0,process.exitValue(),()->{try{return Files.readString(output);}catch(Exception e){return "Browser test failed";}});
    }
    @AfterEach void cleanup() {
        if(uid==null)return;
        var owned=entries.findByUserIdOrderByPositionAscCreatedAtAsc(uid);
        for(var e:owned)if(e.getKind()==WorkspaceEntry.Kind.PDF){try{Files.deleteIfExists(Path.of(".local/workspace-browser-files",e.getId()+".pdf"));}catch(Exception ex){throw new IllegalStateException("Could not remove test PDF",ex);}}
        new TransactionTemplate(manager).executeWithoutResult(status->{entries.deleteAll(owned);preferences.deleteById(uid);users.deleteById(uid);});
    }
}
