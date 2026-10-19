package com.dm.travel_planner.global.security;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.servlet.FilterChain;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class NoticePublisherFilterTest {
    @BeforeEach void login(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("publisher","token",List.of(new SimpleGrantedAuthority("ROLE_NOTICE_PUBLISHER"))));}
    @AfterEach void cleanup(){SecurityContextHolder.clearContext();}
    @Test void allowsOnlyReadingAndPostingNoticesAndOwnProfile()throws Exception {
        for(var pair:List.of(new String[]{"GET","/api/notices"},new String[]{"POST","/api/notices"},new String[]{"GET","/api/users/myProfile"},new String[]{"GET","/api/notices/public"})){
            var chain=mock(FilterChain.class);new NoticePublisherFilter().doFilter(new MockHttpServletRequest(pair[0],pair[1]),new MockHttpServletResponse(),chain);verify(chain).doFilter(any(),any());
        }
    }
    @Test void blocksPersonalDataFinancialDataAndNoticeModification()throws Exception {
        for(var pair:List.of(new String[]{"GET","/api/workspace/entries"},new String[]{"GET","/api/ledger/accounts"},new String[]{"PUT","/api/notices/id"},new String[]{"DELETE","/api/notices/id"},new String[]{"PATCH","/api/users/myProfile"})){
            var chain=mock(FilterChain.class);var response=new MockHttpServletResponse();new NoticePublisherFilter().doFilter(new MockHttpServletRequest(pair[0],pair[1]),response,chain);assertEquals(403,response.getStatus());verifyNoInteractions(chain);
        }
    }
}
