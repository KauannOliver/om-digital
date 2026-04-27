FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
COPY --from=build /app/dist ./dist

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start"]