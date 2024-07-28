FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY .env ./

COPY . .

RUN npm run build

EXPOSE 8000

CMD ["npm", "run", "start:prod"]
