FROM node:20.18.0 AS build
WORKDIR /inimatic
COPY ./ /inimatic
ARG BUILD_SCRIPT
RUN npm install
RUN npm run ${BUILD_SCRIPT}
FROM nginx:latest
COPY --from=build /inimatic/www /usr/share/nginx/html
EXPOSE 80
