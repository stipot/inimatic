# backend.Dockerfile
FROM node:20.18.0
WORKDIR /inimatic_backend
COPY ./backend/package.json ./backend/package-lock.json ./
RUN npm install --force
COPY ./backend ./
EXPOSE 3030
CMD ["npm", "run", "serve:api"]
