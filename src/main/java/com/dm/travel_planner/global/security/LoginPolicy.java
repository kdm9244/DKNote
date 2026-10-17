package com.dm.travel_planner.global.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@Component
public class LoginPolicy {
    private final Set<String> allowed;
    public LoginPolicy(@Value("${app.security.allowed-emails:}") String emails){allowed=new HashSet<>();for(String e:emails.split(","))if(!e.isBlank())allowed.add(e.trim().toLowerCase(Locale.ROOT));}
    public void requireAllowed(String email){if(!allowed.isEmpty()&&(email==null||!allowed.contains(email.trim().toLowerCase(Locale.ROOT))))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"허용되지 않은 계정입니다.");}
}
