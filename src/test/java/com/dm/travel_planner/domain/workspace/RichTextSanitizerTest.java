package com.dm.travel_planner.domain.workspace;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class RichTextSanitizerTest {
    @Test void preservesTableDimensionsAndSafeWidths(){
        var clean=RichTextSanitizer.clean("<table><tr><th colwidth='140' colspan='2'>제목</th><td colwidth='120,180' rowspan='2'>내용</td></tr></table>");
        assertThat(clean).contains("colwidth=\"140\"","colwidth=\"120,180\"","colspan=\"2\"","rowspan=\"2\"");
    }
    @Test void removesUnsafeWidthsAndExecutableMarkup(){
        assertThat(RichTextSanitizer.clean("<table><tr><td colwidth='url(evil)' onclick='alert(1)'>내용</td></tr></table><script>alert(1)</script>"))
                .doesNotContain("colwidth","onclick","script","alert");
    }
}
