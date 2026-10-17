package com.dm.travel_planner.global.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({
            "/",
            "/login",
            "/signup",
            "/oauth2/redirect",
            "/mypage",
            "/planner",
            "/ledger",
            "/ledger/**",
            "/trips/**",
            "/calendar", "/calendar/**", "/learning", "/learning/**", "/settings"
    })
    public String forwardToReact() {
        return "forward:/index.html";
    }
}
