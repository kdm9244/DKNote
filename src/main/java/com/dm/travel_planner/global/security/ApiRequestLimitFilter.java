package com.dm.travel_planner.global.security;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
public class ApiRequestLimitFilter extends OncePerRequestFilter {
    private record Window(long expires,int count){}
    private final ConcurrentHashMap<String,Window> windows=new ConcurrentHashMap<>();
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws IOException,ServletException {
        String path=req.getRequestURI();
        boolean auth=path.startsWith("/api/auth/");boolean chat=path.endsWith("/chat")&&path.startsWith("/api/ai/");
        if(auth||chat){
            var principal=SecurityContextHolder.getContext().getAuthentication();
            String key=(auth?"auth:":"chat:")+(principal==null?req.getRemoteAddr():principal.getName());long now=System.currentTimeMillis();
            if(windows.size()>2000)windows.entrySet().removeIf(e->e.getValue().expires<now);
            if(windows.size()>=4096&&!windows.containsKey(key)){res.sendError(429,"잠시 후 다시 시도하세요.");return;}
            Window value=windows.compute(key,(k,w)->w==null||w.expires<now?new Window(now+60000,1):new Window(w.expires,w.count+1));
            if(value.count>(auth?20:30)){res.setStatus(429);res.setContentType("application/json;charset=UTF-8");res.setHeader("Retry-After","60");res.getWriter().write("{\"message\":\"요청이 많습니다. 잠시 후 다시 시도하세요.\"}");return;}
        }
        chain.doFilter(req,res);
    }
}
