package com.dm.travel_planner.domain.workspace;

import org.junit.jupiter.api.Test;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;

class GoogleCalendarRequestTest {
    @Test void midnightRangeIncludesSecondsRequiredByGoogleRfc3339() {
        String query=URLDecoder.decode(GoogleCalendarService.eventQueryPath("primary",LocalDate.of(2026,9,27),LocalDate.of(2026,11,7)),StandardCharsets.UTF_8);
        assertTrue(query.contains("timeMin=2026-09-27T00:00:00+09:00"));
        assertTrue(query.contains("timeMax=2026-11-08T00:00:00+09:00"));
        assertTrue(query.contains("singleEvents=true&orderBy=startTime"));
    }

    @Test void oneDayRangeIncludesWholeLeapDayAndEncodesCalendarId() {
        String path=GoogleCalendarService.eventQueryPath("calendar+shared@example.com",LocalDate.of(2028,2,29),LocalDate.of(2028,2,29));
        assertTrue(path.startsWith("/calendars/calendar%2Bshared%40example.com/events?"));
        String query=URLDecoder.decode(path,StandardCharsets.UTF_8);
        assertTrue(query.contains("timeMin=2028-02-29T00:00:00+09:00"));
        assertTrue(query.contains("timeMax=2028-03-01T00:00:00+09:00"));
    }
}
