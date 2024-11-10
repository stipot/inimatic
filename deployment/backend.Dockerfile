FROM node:20.18.0
WORKDIR /inimatic_backend
COPY ./backend /inimatic_backend/backend
COPY ./package.json /inimatic_backend
COPY ./package-lock.json /inimatic_backend

RUN npm install --force
CMD ["npm", "run", "serve:api"]
EXPOSE 3030
