FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000
EXPOSE 9007/udp

CMD ["node", "server.js"]
