###############
# base images #
###############
FROM node:18.16.0-alpine as frontend-base
FROM golang:1.27.2-bookworm@sha256:5cf287a799e6b94384bad13d16b14904c531f51ba65792237e122ce42b392f61 as server-base
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 as final


##############################
# frontend development stage #
##############################
FROM frontend-base as frontend-devel
WORKDIR /app
COPY frontend /app/
RUN apk add --no-cache git curl


#############################
# build angular application #
#############################
FROM frontend-base as frontend-build
WORKDIR /app
COPY frontend /app/
RUN npm install && \
    npm run-script build


############################
# server development stage #
############################
FROM server-base as server-devel
WORKDIR /go/src/github.com/rclsilver/asl-bissieux
COPY . /go/src/github.com/rclsilver/asl-bissieux
ENTRYPOINT ["go", "run", "main.go"]


########################
# build Go application #
########################
FROM server-base as server-build
WORKDIR /go/src/github.com/rclsilver/asl-bissieux
COPY . /go/src/github.com/rclsilver/asl-bissieux
COPY --from=frontend-build /app/dist/asl-bissieux /go/src/github.com/rclsilver/asl-bissieux/frontend/dist/asl-bissieux
RUN make asl-bissieux


#####################
# build final image #
#####################
FROM final
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S -g 10001 app && adduser -S -u 10001 -G app app && \
    mkdir /app
WORKDIR /app

COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux /app/asl-bissieux
COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux.yaml /app/asl-bissieux.yaml

EXPOSE 8080
USER 10001:10001

ENTRYPOINT [ "/app/asl-bissieux" ]
