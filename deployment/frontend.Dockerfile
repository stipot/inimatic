FROM node:20.18.0 AS build
WORKDIR /inimatic
COPY ./ /inimatic
RUN npm install
RUN npm run build
FROM nginx:latest
COPY --from=build /inimatic/www /usr/share/nginx/html
# COPY ./deployment/inimatic_nginx.conf /etc/nginx/conf.d/
EXPOSE 80 3000 443
