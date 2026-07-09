# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────────
# bookworm (not alpine): CGO_ENABLED=1 needs glibc, and glibc parity with the
# distroless/cc runtime keeps the ONNX Runtime .so loadable.
FROM golang:1.24-bookworm AS build
# CI: pin to a digest -> FROM golang:1.24-bookworm@sha256:<FILL IN CI> AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=1 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/imagewarden ./cmd/imagewarden

# ── ONNX Runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS ort
# CI: pin to a digest -> FROM debian:bookworm-slim@sha256:<FILL IN CI> AS ort
ARG ORT_VERSION=1.20.1
ARG TARGETARCH
# GitHub releases name tarballs by ORT's arch spelling: amd64->x64, arm64->aarch64.
# --checksum pins the tarball (supply-chain pin, spec §9); fill the real sha256 in
# CI when ORT_VERSION is locked — the .so pin and the Go binding pin move together
# (spec §3.4). Two ADDs (one per arch) keep --checksum static per line.
RUN case "${TARGETARCH}" in \
      amd64) echo x64 > /tmp/ort_arch ;; \
      arm64) echo aarch64 > /tmp/ort_arch ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac
ADD --checksum=sha256:<FILL IN CI — amd64 tarball> \
    https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-linux-x64-${ORT_VERSION}.tgz \
    /tmp/ort-x64.tgz
ADD --checksum=sha256:<FILL IN CI — arm64 tarball> \
    https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-linux-aarch64-${ORT_VERSION}.tgz \
    /tmp/ort-aarch64.tgz
RUN mkdir -p /opt/ort && \
    tar -xzf /tmp/ort-$(cat /tmp/ort_arch).tgz -C /opt/ort --strip-components=1

# ── Runtime ──────────────────────────────────────────────────────────────
# distroless/cc: glibc + libstdc++, no shell, no package manager, nonroot uid.
FROM gcr.io/distroless/cc-debian12:nonroot
# CI: pin -> FROM gcr.io/distroless/cc-debian12:nonroot@sha256:<FILL IN CI>
COPY --from=ort   /opt/ort/lib/libonnxruntime.so* /usr/lib/
COPY --from=build /out/imagewarden               /usr/local/bin/imagewarden
COPY model/                                        /usr/share/imagewarden/model/
COPY docker/config.yml                             /etc/imagewarden/config.yml
# The model adapter (task 010) dlopens the ORT .so from this path.
ENV ORT_DYLIB_PATH=/usr/lib/libonnxruntime.so
USER nonroot
EXPOSE 8080
# distroless has no wget/curl -> the binary probes itself (spec §7).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD ["/usr/local/bin/imagewarden", "healthcheck"]
# Entrypoint-as-CLI passthrough (nginxpilot idiom): CMD supplies the default
# subcommand, args override it —
#   docker run --rm img validate
#   docker run --rm -v "$PWD":/in img classify /in/pic.jpg
# Intended hardened run flags (spec §9): --read-only --cap-drop ALL
#   docker run --rm --read-only --cap-drop ALL -p 8080:8080 \
#     -e IMAGEWARDEN_TOKEN=... img
ENTRYPOINT ["/usr/local/bin/imagewarden"]
CMD ["run"]
