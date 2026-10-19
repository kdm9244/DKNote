package com.dm.travel_planner.global.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

/** A publishing credential cannot access personal workspace or financial APIs. */
public class NoticePublisherFilter extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        boolean publisher=auth!=null&&auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_NOTICE_PUBLISHER"));
        String path=request.getRequestURI(),method=request.getMethod();
        if(publisher&&path.startsWith("/api/")&&!method.equals("OPTIONS")) {
            boolean allowed=path.equals("/api/notices")&&(method.equals("GET")||method.equals("POST"))
                    ||path.matches("/api/notices/[^/]+")&&!path.equals("/api/notices/public")&&(method.equals("PUT")||method.equals("DELETE"))
                    ||path.equals("/api/notices/public")&&method.equals("GET")
                    ||path.equals("/api/users/myProfile")&&method.equals("GET");
            if(!allowed){response.setStatus(403);response.setContentType("application/json;charset=UTF-8");response.getWriter().write("{\"message\":\"공지 관리 전용 계정입니다.\"}");return;}
        }
        chain.doFilter(request,response);
    }
}
