###############
# base images #
###############
FROM node:14.16.1-alpine as frontend-base
FROM golang:1.20.2-buster as server-base
FROM alpine:3.15.4 as final


##############################
# frontend development stage #
##############################
#FROM frontend-base as frontend-devel
#WORKDIR /app
#COPY frontend /app/
#RUN apk add --no-cache git
#RUN mkdir /tmp/node_modules && ln -s /tmp/node_modules /app/node_modules


#############################
# build angular application #
#############################
#FROM frontend-base as frontend-build
#WORKDIR /app
#COPY frontend /app/
#RUN npm run-script build


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
RUN make asl-bissieux


#####################
# build final image #
#####################
FROM final
RUN mkdir /app
WORKDIR /app

#COPY --from=frontend-build /app/dist/asl /app/frontend
COPY --from=server-build /go/src/github.com/rclsilver/asl-bissieux/asl-bissieux /app/asl-bissieux

EXPOSE 8080

ENTRYPOINT [ "/app/asl-bissieux" ]
