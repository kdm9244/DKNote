package com.dm.travel_planner.global.security;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import org.springframework.security.oauth2.jwt.*;
import jakarta.servlet.FilterChain;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SecurityHardeningTest {
    @Test void cloudflareGateRejectsMissingAndInvalidAssertions() throws Exception {
        JwtDecoder decoder=mock(JwtDecoder.class);var filter=new CloudflareAccessFilter(decoder);FilterChain chain=mock(FilterChain.class);
        var request=new MockHttpServletRequest("GET","/api/workspace/entries");var response=new MockHttpServletResponse();filter.doFilter(request,response,chain);assertEquals(403,response.getStatus());verifyNoInteractions(chain);
        request=new MockHttpServletRequest("GET","/api/workspace/entries");request.addHeader("Cf-Access-Jwt-Assertion","forged");response=new MockHttpServletResponse();when(decoder.decode("forged")).thenThrow(new JwtException("invalid"));filter.doFilter(request,response,chain);assertEquals(403,response.getStatus());verifyNoInteractions(chain);
    }
    @Test void cloudflareGateAllowsValidatedAssertionAndHarmlessHealthCheck() throws Exception {
        JwtDecoder decoder=mock(JwtDecoder.class);var filter=new CloudflareAccessFilter(decoder);FilterChain chain=mock(FilterChain.class);
        var request=new MockHttpServletRequest("GET","/api/workspace/entries");request.addHeader("Cf-Access-Jwt-Assertion","valid");when(decoder.decode("valid")).thenReturn(Jwt.withTokenValue("valid").header("alg","RS256").claim("sub","allowed").build());filter.doFilter(request,new MockHttpServletResponse(),chain);verify(chain).doFilter(any(),any());
        var healthChain=mock(FilterChain.class);filter.doFilter(new MockHttpServletRequest("GET","/health"),new MockHttpServletResponse(),healthChain);verify(healthChain).doFilter(any(),any());
    }
    @Test void loginAllowlistRejectsUnlistedEmailAndHandlesCase() {
        var policy=new LoginPolicy("owner@example.com");assertDoesNotThrow(()->policy.requireAllowed("OWNER@example.com"));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->policy.requireAllowed("other@example.com"));
    }
    @Test void repeatedLoginRequestsReceive429() throws Exception {
        var filter=new ApiRequestLimitFilter();FilterChain chain=mock(FilterChain.class);
        for(int i=0;i<20;i++)filter.doFilter(new MockHttpServletRequest("POST","/api/auth/login"),new MockHttpServletResponse(),chain);
        var response=new MockHttpServletResponse();filter.doFilter(new MockHttpServletRequest("POST","/api/auth/login"),response,chain);assertEquals(429,response.getStatus());assertEquals("60",response.getHeader("Retry-After"));
    }
}
