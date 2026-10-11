FROM python:3.12-slim AS geography
WORKDIR /app
COPY scripts/geo-requirements.txt ./scripts/geo-requirements.txt
RUN pip install --no-cache-dir -r scripts/geo-requirements.txt
COPY scripts/prepare_geo.py ./scripts/prepare_geo.py
RUN python scripts/prepare_geo.py

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY --from=geography /app/public/geo ./public/geo
COPY --from=geography /app/src/data/referenceCatalog.json ./src/data/referenceCatalog.json
ENV VITE_BASE_PATH=/
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
