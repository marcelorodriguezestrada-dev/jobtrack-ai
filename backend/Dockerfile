# Usamos la imagen oficial de Playwright, que ya incluye Node.js +
# Chromium + todas las dependencias de sistema necesarias (fonts,
# librerías gráficas, etc.) — evita la parte más frágil de instalar
# Playwright a mano en una imagen base genérica.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
# cache bust mi.,  1 de jul. de 2026  6:50:24
