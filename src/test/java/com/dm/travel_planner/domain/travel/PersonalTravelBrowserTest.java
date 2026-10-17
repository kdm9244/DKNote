package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.domain.user.entity.*;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfSystemProperty(named="travel.browser.test",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"market-data.sync-initial-delay-ms=3600000","app.upload.checklist-dir=./.local/travel-browser-files"})
class PersonalTravelBrowserTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    String uid;
    @Test void personalTravelWorksInBrowserAndPersists() throws Exception {
        uid="travel_browser_"+UUID.randomUUID().toString().replace("-","");
        users.saveAndFlush(User.builder().userId(uid).email(uid+"@example.test").nickname("여행 화면 검증").provider(AuthProvider.LOCAL).role(UserRole.USER).build());
        var builder=new ProcessBuilder("C:\\Program Files\\nodejs\\node.exe","tests/travel-smoke.mjs").directory(Path.of(System.getProperty("travel.frontend.dir","frontend")).toFile()).redirectErrorStream(true);
        builder.environment().put("TRAVEL_TEST_URL","http://localhost:"+port);
        builder.environment().put("TRAVEL_TEST_TOKEN",jwt.createToken(uid,uid+"@example.test","USER"));
        Path output=Path.of(".local/travel-browser.log");Files.createDirectories(output.getParent());builder.redirectOutput(output.toFile());
        var process=builder.start();if(!process.waitFor(150,TimeUnit.SECONDS)){process.destroyForcibly();fail("Travel browser timed out");}
        assertEquals(0,process.exitValue(),()->{try{return Files.readString(output);}catch(Exception e){return "Browser failed";}});
    }
    @AfterEach void cleanup() throws Exception {
        if(uid==null)return;
        var files=jdbc.queryForList("select file_url from checklist_attachments where uploaded_by_id=?",String.class,uid);
        new TransactionTemplate(transactions).executeWithoutResult(s->{
            jdbc.update("delete from checklist_attachments where uploaded_by_id=?",uid);
            for(String table:List.of("travel_reservations","travel_places","budget_items","checklist_items"))jdbc.update("delete from "+table+" where trip_id in (select trip_id from trips where owner_id=?)",uid);
            jdbc.update("delete from activities where day_id in(select day_id from days where trip_id in(select trip_id from trips where owner_id=?))",uid);
            jdbc.update("delete from days where trip_id in(select trip_id from trips where owner_id=?)",uid);
            jdbc.update("delete from trips where owner_id=?",uid);
            jdbc.update("delete from workspace_preferences where user_id=?",uid);
            users.deleteById(uid);
        });
        for(String file:files)Files.deleteIfExists(Path.of(".local/travel-browser-files",Path.of(file).getFileName().toString()));
    }
}
