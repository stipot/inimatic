# backend.Dockerfile
FROM node:20.18.0
WORKDIR /inimatic_backend
COPY ./package.json /inimatic_backend
COPY ./package-lock.json /inimatic_backend
RUN npm install --force
COPY ./backend /inimatic_backend/backend
EXPOSE 3030
CMD ["npm", "run", "serve:api"]
