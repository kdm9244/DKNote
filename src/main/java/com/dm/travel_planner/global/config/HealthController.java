package com.dm.travel_planner.global.config;
@org.springframework.web.bind.annotation.RestController
public class HealthController {
    @org.springframework.web.bind.annotation.GetMapping("/health") public java.util.Map<String,String> health(){return java.util.Map.of("status","ok");}
}
