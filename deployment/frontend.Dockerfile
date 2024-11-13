# frontend.Dockerfile
FROM node:20.18.0 AS build
WORKDIR /inimatic
COPY ./frontend/package.json ./frontend/package-lock.json ./
RUN npm install
COPY ./frontend ./
RUN npm run build

FROM nginx:latest
COPY --from=build /inimatic/build /usr/share/nginx/html
# COPY ./deployment/inimatic_nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
