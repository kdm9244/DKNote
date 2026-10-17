package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Set;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties="market-data.sync-initial-delay-ms=3600000") @AutoConfigureMockMvc
class RetiredFeatureRoutesTest {
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider jwt;
    @Test void removedTeamAndFeedEndpointsAreUnavailableToAuthenticatedUsers()throws Exception{
        String auth="Bearer "+jwt.createToken("cleanup_test_owner","cleanup@example.test","USER");
        mvc.perform(get("/api/travel/trips").header("Authorization",auth)).andExpect(status().isOk());
        for(String path:new String[]{"/api/teams","/api/feeds","/api/feeds/files/old.png"})mvc.perform(get(path).header("Authorization",auth)).andExpect(status().isNotFound());
        for(String path:new String[]{"/api/teams","/api/feeds/posts","/api/feeds/upload"})mvc.perform(post(path).header("Authorization",auth).contentType("application/json").content("{}"))
            .andExpect(r->assertTrue(Set.of(404,405).contains(r.getResponse().getStatus()),"Removed write route must not accept requests"));
    }
}
