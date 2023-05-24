FROM golang:1.20 AS builder

RUN set -eux && \
  git clone https://github.com/ovh/cds.git $GOPATH/src/github.com/ovh/cds && \
  cd $GOPATH/src/github.com/ovh/cds/tools/smtpmock && \
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -o /tmp/smtpmocksrv github.com/ovh/cds/tools/smtpmock/server && \
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -o /tmp/smtpmockcli github.com/ovh/cds/tools/smtpmock/cli && \
  cd - && \
  rm -rf $GOPATH/src/github.com/ovh

# final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /tmp/smtpmocksrv ./
COPY --from=builder /tmp/smtpmockcli ./
RUN chmod +x ./smtpmocksrv
ENTRYPOINT ["./smtpmocksrv"]
CMD ["start"]
EXPOSE 2023 2024
