package com.dm.travel_planner.global.storage;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;
import java.io.*;
import java.net.URI;
import java.time.Duration;

@Component
@ConditionalOnProperty(name="app.storage.provider", havingValue="r2")
public class R2Storage {
    private final S3Client client;
    private final String bucket;

    public R2Storage(@Value("${app.storage.r2.endpoint:}") String endpoint,
                     @Value("${app.storage.r2.bucket:dknote-files}") String bucket,
                     @Value("${app.storage.r2.access-key-id:}") String access,
                     @Value("${app.storage.r2.secret-access-key:}") String secret) {
        if (endpoint.isBlank() || bucket.isBlank() || access.isBlank() || secret.isBlank())
            throw new IllegalStateException("R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 설정이 필요합니다.");
        URI uri = URI.create(endpoint);
        if (!"https".equals(uri.getScheme()) || uri.getHost()==null
                || !uri.getHost().endsWith(".r2.cloudflarestorage.com")
                || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null
                || (uri.getPort()!=-1 && uri.getPort()!=443)
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
            throw new IllegalStateException("R2_ENDPOINT에는 버킷 경로 없는 Cloudflare HTTPS S3 endpoint를 입력하세요.");
        this.bucket=bucket;
        client=S3Client.builder().endpointOverride(uri).region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClientBuilder(UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(5)).socketTimeout(Duration.ofSeconds(30)))
                .overrideConfiguration(c->c.apiCallTimeout(Duration.ofSeconds(90)).apiCallAttemptTimeout(Duration.ofSeconds(40)))
                .build();
    }

    public void put(String key, InputStream input, long size, String type) {
        client.putObject(PutObjectRequest.builder().bucket(bucket).key(key)
                .contentType(type==null?"application/octet-stream":type).build(),RequestBody.fromInputStream(input,size));
    }

    public Resource resource(String key) {
        long length=client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build()).contentLength();
        return new AbstractResource() {
            @Override public String getDescription() { return "Private stored attachment"; }
            @Override public long contentLength() { return length; }
            @Override public InputStream getInputStream() throws IOException {
                try { return client.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build()); }
                catch (RuntimeException ex) { throw new IOException("저장된 파일을 읽을 수 없습니다.",ex); }
            }
        };
    }

    public void delete(String key) { client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build()); }
    @PreDestroy public void close() { client.close(); }
}
