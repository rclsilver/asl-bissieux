###############
# base images #
###############
FROM node:18.16.0-alpine as frontend-base
FROM golang:1.20.2-buster as server-base
FROM alpine:3.15.4 as final


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
RUN mkdir /app
WORKDIR /app

COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux /app/asl-bissieux
COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux.yaml /app/asl-bissieux.yaml

EXPOSE 8080

ENTRYPOINT [ "/app/asl-bissieux" ]
