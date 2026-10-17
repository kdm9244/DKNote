package com.dm.travel_planner.global.storage;

import com.dm.travel_planner.domain.workspace.*;
import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachment;
import com.dm.travel_planner.domain.checklist.repository.ChecklistAttachmentRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.*;
import java.security.*;
import java.util.*;

/** Explicit local-only maintenance operation. Never deletes source files. */
@Slf4j @Component @RequiredArgsConstructor
@ConditionalOnProperty(name="app.storage.migrate-local-files",havingValue="true")
public class LocalFileMigration implements ApplicationRunner {
    private final WorkspaceRepository workspace;
    private final WorkspaceService documents;
    private final ChecklistAttachmentRepository attachments;
    private final StoredFiles storage;
    private final PlatformTransactionManager transactions;
    private final EntityManager entities;
    @Value("${app.storage.provider:local}") private String provider;

    @Override public void run(ApplicationArguments arguments) {
        if(!provider.equals("r2")) throw new IllegalStateException("파일 이전에는 FILE_STORAGE_PROVIDER=r2가 필요합니다.");
        TransactionTemplate tx=new TransactionTemplate(transactions);
        int copied=0,failed=0;
        for(int page=0;;page++) {
            var rows=workspace.findAll(PageRequest.of(page,100,Sort.by("id")));
            for(var row:rows) {
                if(row.getKind()!=WorkspaceEntry.Kind.PDF) continue;
                try {
                    Boolean changed=tx.execute(status->{
                        var item=workspace.findById(row.getId()).orElse(null);
                        if(item==null) return false;
                        entities.lock(item,LockModeType.PESSIMISTIC_WRITE);
                        var details=new LinkedHashMap<>(documents.read(item.getDetails()));
                        String old=String.valueOf(details.getOrDefault("fileKey",item.getId()+".pdf"));
                        if(old.startsWith("r2://")) return false;
                        details.put("fileKey",copy(StoredFiles.Area.LEARNING,old,"application/pdf"));
                        item.setDetails(documents.write(details));
                        workspace.saveAndFlush(item); return true;
                    });
                    if(Boolean.TRUE.equals(changed)) copied++;
                } catch(Exception ex) { failed++; log.warn("PDF 이전 실패: id={} (원본과 DB 참조 유지)",row.getId()); }
            }
            if(!rows.hasNext()) break;
        }
        for(int page=0;;page++) {
            var rows=attachments.findAll(PageRequest.of(page,100,Sort.by("attachmentId")));
            for(var row:rows) {
                try {
                    Boolean changed=tx.execute(status->{
                        ChecklistAttachment item=attachments.findById(row.getAttachmentId()).orElse(null);
                        if(item==null) return false;
                        entities.lock(item,LockModeType.PESSIMISTIC_WRITE);
                        if(item.getFileUrl().startsWith("r2://")) return false;
                        item.relocateFile(copy(StoredFiles.Area.CHECKLIST,item.getFileUrl(),item.getContentType()));
                        attachments.saveAndFlush(item); return true;
                    });
                    if(Boolean.TRUE.equals(changed)) copied++;
                } catch(Exception ex) { failed++; log.warn("첨부파일 이전 실패: id={} (원본과 DB 참조 유지)",row.getAttachmentId()); }
            }
            if(!rows.hasNext()) break;
        }
        log.info("R2 파일 이전 완료: copied={}, failed={}. 로컬 원본은 보존했습니다.",copied,failed);
        if(failed>0) throw new IllegalStateException("일부 파일 이전에 실패했습니다. 로컬 경로와 R2 설정을 확인 후 다시 실행하세요.");
    }

    private String copy(StoredFiles.Area area,String old,String type) {
        Resource source=storage.resource(area,old);
        try {
            long size=source.contentLength();
            byte[] expected=hash(source);
            String reference;
            try(var input=source.getInputStream()) { reference=storage.store(area,input,size,type); }
            Resource destination=storage.resource(area,reference);
            if(destination.contentLength()!=size || !MessageDigest.isEqual(expected,hash(destination)))
                throw new IllegalStateException("파일 이전 무결성 확인 실패");
            return reference;
        } catch(IOException ex) { throw new IllegalStateException("로컬 파일 이전 실패",ex); }
    }
    private byte[] hash(Resource file) throws IOException {
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            try(var input=new DigestInputStream(file.getInputStream(),digest)) { input.transferTo(OutputStream.nullOutputStream()); }
            return digest.digest();
        } catch(NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
