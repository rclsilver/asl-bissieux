###############
# base images #
###############
FROM node:24.22.0-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS frontend-base
ARG NODE_NETWORK_OPTIONS=""
ENV NODE_OPTIONS=${NODE_NETWORK_OPTIONS}
FROM golang:1.27.3-bookworm@sha256:972b4110ba0f47539a975c31e52c64765e1ff19f2d74469ae4a595c6676e80a5 AS server-base
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS runtime-base


################################
# shared frontend dependencies #
################################
FROM frontend-base AS frontend-deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund


##############################
# frontend development stage #
##############################
FROM frontend-deps AS frontend-devel
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY frontend /app/


#############################
# build angular application #
#############################
FROM frontend-deps AS frontend-build
COPY frontend /app/
RUN npm run-script build


############################
# server development stage #
############################
FROM server-base AS server-devel
WORKDIR /go/src/github.com/rclsilver/asl-bissieux
COPY . /go/src/github.com/rclsilver/asl-bissieux
ENTRYPOINT ["go", "run", "main.go"]


########################
# build Go application #
########################
FROM server-base AS server-build
ARG VERSION=dev
ARG COMMIT=unknown
WORKDIR /go/src/github.com/rclsilver/asl-bissieux
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . /go/src/github.com/rclsilver/asl-bissieux
COPY --from=frontend-build /app/dist/asl-bissieux /go/src/github.com/rclsilver/asl-bissieux/frontend/dist/asl-bissieux
RUN make asl-bissieux VERSION="$VERSION" COMMIT="$COMMIT"


#####################
# build final image #
#####################
FROM runtime-base AS final
ARG VERSION=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$COMMIT
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S -g 10001 app && adduser -S -u 10001 -G app app && \
    mkdir /app
WORKDIR /app

COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux /app/asl-bissieux
COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux.yaml /app/asl-bissieux.yaml

EXPOSE 8080
USER 10001:10001

ENTRYPOINT [ "/app/asl-bissieux" ]
