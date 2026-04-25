FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /proxy-interceptor ./cmd/proxy/main.go

FROM alpine:3.19

RUN apk --no-cache add ca-certificates

RUN adduser -D -g '' appuser

COPY --from=builder /proxy-interceptor /usr/local/bin/proxy-interceptor

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["proxy-interceptor"]
