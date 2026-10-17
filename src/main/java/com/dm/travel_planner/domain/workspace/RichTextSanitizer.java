package com.dm.travel_planner.domain.workspace;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.jsoup.nodes.Document;
public final class RichTextSanitizer {
    private RichTextSanitizer(){}
    private static final Safelist ALLOWED=Safelist.none().addTags("p","br","strong","b","em","s","u","span","mark","h1","h2","h3","ul","ol","li","blockquote","pre","code","hr","table","thead","tbody","tr","th","td").addAttributes("span","style").addAttributes("mark","style","data-color").addAttributes("th","colspan","rowspan").addAttributes("td","colspan","rowspan");
    public static String clean(String body) {
        if(body.length()>500000)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"내용이 너무 큽니다.");
        var document=Jsoup.parseBodyFragment(Jsoup.clean(body,"",ALLOWED,new Document.OutputSettings().prettyPrint(false)));document.outputSettings().prettyPrint(false);
        for(var element:document.select("[style]")){
            StringBuilder safe=new StringBuilder();
            for(String rule:element.attr("style").split(";"))if(rule.trim().matches("(?i)(color|background-color)\\s*:\\s*(#[a-f0-9]{3,8}|rgba?\\([0-9\\s,.%]+\\))"))safe.append(rule.trim()).append(';');
            if(safe.isEmpty())element.removeAttr("style");else element.attr("style",safe.toString());
        }
        return document.body().html();
    }
}
