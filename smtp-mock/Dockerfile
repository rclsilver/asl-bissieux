FROM golang:1.27.3-bookworm@sha256:972b4110ba0f47539a975c31e52c64765e1ff19f2d74469ae4a595c6676e80a5 AS builder

ARG CDS_REVISION=842a22a27931a618da66430656d4ae606bdcdff1

RUN set -eux && \
  git init /src && cd /src && \
  git remote add origin https://github.com/ovh/cds.git && \
  git fetch --depth=1 origin "$CDS_REVISION" && git checkout --detach FETCH_HEAD && \
  test "$(git rev-parse HEAD)" = "$CDS_REVISION" && \
  mkdir /out

WORKDIR /src/tools/smtpmock
COPY go.mod go.sum ./
RUN go mod download && go mod verify && \
    CGO_ENABLED=0 go build -mod=readonly -trimpath -buildvcs=false -o /out/smtpmocksrv ./server && \
    CGO_ENABLED=0 go build -mod=readonly -trimpath -buildvcs=false -o /out/smtpmockcli ./cli

# final stage
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk --no-cache add ca-certificates
COPY --from=builder /out/smtpmocksrv ./
COPY --from=builder /out/smtpmockcli ./
RUN chmod +x ./smtpmocksrv
ENTRYPOINT ["./smtpmocksrv"]
CMD ["start"]
EXPOSE 2023 2024
