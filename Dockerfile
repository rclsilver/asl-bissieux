# development stage (lts-alpine)
FROM node:14.16.1-alpine as devel-stage
WORKDIR /app
COPY . /app/
RUN apk update && apk add git
RUN mkdir /tmp/node_modules && ln -s /tmp/node_modules /app/node_modules

# build application (lts-alpine)
FROM node:14.16.1-alpine as build-stage
WORKDIR /app
COPY . /app/
RUN npm install
RUN npm run-script build

# build final image
FROM nginx:1.19.4-alpine
COPY --from=build-stage /app/dist/asl-bissieux /usr/share/nginx/html
VOLUME /usr/share/nginx/html/assets
