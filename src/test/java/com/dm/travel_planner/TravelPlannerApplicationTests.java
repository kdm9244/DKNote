package com.dm.travel_planner;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TravelPlannerApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void contextLoads() {
	}

	@Test
	void protectedApiRejectsAnonymousRequests() throws Exception {
		mockMvc.perform(get("/api/users/myProfile"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void authenticationApiRemainsPublic() throws Exception {
		mockMvc.perform(post("/api/auth/login")
					.contentType("application/json")
					.content("{}"))
				.andExpect(status().isBadRequest());
	}

}
