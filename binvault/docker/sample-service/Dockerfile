# syntax=docker/dockerfile:1
# Build context: the binvault module root (compose passes `context: ..`).
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
COPY docker/sample-service ./docker/sample-service
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/sample-service ./docker/sample-service

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/sample-service /usr/local/bin/sample-service
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/usr/local/bin/sample-service"]
