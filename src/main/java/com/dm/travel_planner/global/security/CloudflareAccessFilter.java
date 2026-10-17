package com.dm.travel_planner.global.security;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
public class CloudflareAccessFilter extends OncePerRequestFilter {
    private final JwtDecoder decoder;
    public CloudflareAccessFilter(String issuer,String audience){
        if(!issuer.matches("https://[a-zA-Z0-9-]+\\.cloudflareaccess\\.com")||audience.isBlank())throw new IllegalArgumentException("Cloudflare Access issuer/audience 설정이 필요합니다.");
        var jwt= NimbusJwtDecoder.withJwkSetUri(issuer+"/cdn-cgi/access/certs").build();
        jwt.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer),token->token.getAudience().contains(audience)?OAuth2TokenValidatorResult.success():OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"))));decoder=jwt;
    }
    public CloudflareAccessFilter(JwtDecoder decoder){this.decoder=decoder;}
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException {
        if(req.getMethod().equals("OPTIONS")||req.getRequestURI().equals("/health")){chain.doFilter(req,res);return;}
        try{String token=req.getHeader("Cf-Access-Jwt-Assertion");if(token==null||token.isBlank())throw new JwtException("missing");decoder.decode(token);}
        catch(JwtException ex){res.setStatus(403);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"Cloudflare 인증이 필요합니다. 보호된 주소로 접속하세요.\"}");return;}
        chain.doFilter(req,res);
    }
}
