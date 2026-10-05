// Generator of the aws-sdk-java-v2 aws-chunked entries of ../vectors.json.
// Jars (2.55.10 from Maven Central): http-auth-aws annotations utils
// identity-spi http-client-spi http-auth-spi checksums-spi checksums
// metrics-spi endpoints-spi, plus slf4j-api 1.7.36 and reactive-streams 1.0.4.
//   javac -cp "$(ls *.jar | tr "\n" :)" Gen.java
//   java -cp "$(ls *.jar | tr "\n" :):." Gen > java_vectors.jsonl

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import software.amazon.awssdk.http.*;
import software.amazon.awssdk.http.auth.aws.signer.AwsV4HttpSigner;
import software.amazon.awssdk.http.auth.spi.signer.*;
import software.amazon.awssdk.identity.spi.AwsCredentialsIdentity;
import software.amazon.awssdk.checksums.DefaultChecksumAlgorithm;

public class Gen {
    static String esc(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    static void gen(String name, String region, String path, boolean signedPayload, boolean checksum, boolean zeta, int n, String proto) throws Exception {
        byte[] payload = new byte[n];
        for (int i = 0; i < n; i++) payload[i] = (byte) (i % 251);
        SdkHttpRequest.Builder rb = SdkHttpRequest.builder()
            .method(SdkHttpMethod.PUT).protocol(proto).host("127.0.0.1").port(9000)
            .encodedPath(path)
            .putHeader("Content-Length", Integer.toString(n))
            .putHeader("Content-Type", "application/octet-stream");
        if (zeta) {
            rb.putHeader("x-amz-zeta", "  last   one ");
            rb.putHeader("x-amz-trailer", "x-amz-zeta");
        }
        SdkHttpRequest req = rb.build();
        AwsV4HttpSigner signer = AwsV4HttpSigner.create();
        SignedRequest signed = signer.sign(r -> {
            r.identity(AwsCredentialsIdentity.create("BVKABCDEFGHIJKLMNOPQ", "q7Zr2Xv9LmT4Wc8Ns1Ke5Yd3Hb6Gf0Ja2Pu7Ro9V"))
             .request(req)
             .payload(ContentStreamProvider.fromByteArray(payload))
             .putProperty(AwsV4HttpSigner.SERVICE_SIGNING_NAME, "s3")
             .putProperty(AwsV4HttpSigner.REGION_NAME, region)
             .putProperty(AwsV4HttpSigner.DOUBLE_URL_ENCODE, false)
             .putProperty(AwsV4HttpSigner.NORMALIZE_PATH, false)
             .putProperty(AwsV4HttpSigner.CHUNK_ENCODING_ENABLED, true)
             .putProperty(AwsV4HttpSigner.PAYLOAD_SIGNING_ENABLED, signedPayload)
             .putProperty(HttpSigner.SIGNING_CLOCK, Clock.fixed(Instant.parse("2025-01-15T12:34:56Z"), ZoneOffset.UTC));
            if (checksum) r.putProperty(AwsV4HttpSigner.CHECKSUM_ALGORITHM, DefaultChecksumAlgorithm.CRC32);
        });
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream in = signed.payload().get().newStream()) { in.transferTo(out); }
        StringBuilder h = new StringBuilder("[");
        boolean first = true;
        for (Map.Entry<String, List<String>> e : signed.request().headers().entrySet()) {
            for (String v : e.getValue()) {
                if (!first) h.append(",");
                first = false;
                h.append("[").append(esc(e.getKey())).append(",").append(esc(v)).append("]");
            }
        }
        h.append("]");
        System.out.println("{\"name\":" + esc(name) + ",\"region\":" + esc(region) + ",\"path\":" + esc(path)
            + ",\"payload_len\":" + n + ",\"headers\":" + h
            + ",\"body_b64\":" + esc(Base64.getEncoder().encodeToString(out.toByteArray())) + "}");
    }

    public static void main(String[] a) throws Exception {
        gen("java-signed-trailer", "auto", "/bucket/photos/caf%C3%A9%20%2B%20%2A.jpg", true, true, true, 300000, "http");
        gen("java-signed", "eu-central-1", "/bucket/plain.bin", true, false, false, 140000, "http");
        gen("java-unsigned-trailer", "garage", "/bucket/unsigned.bin", false, true, true, 140000, "https");
        gen("java-signed-trailer-empty", "us-east-1", "/bucket/empty", true, true, false, 0, "http");
    }
}
