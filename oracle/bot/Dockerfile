# Gunakan base image Node.js Alpine (Ringan)
FROM node:18-alpine

WORKDIR /usr/src/app

# 1. Salin file definisi dependency dulu
COPY package*.json ./

# 2. Jalankan install DI DALAM Docker (karena host tidak punya npm)
# --production agar hanya menginstall dependency penting (hemat size)
RUN npm install --production

# 3. Salin sisa file kode (index.js, folder abi, keystore, dll)
COPY . .

# Install PM2
RUN npm install -g pm2

# Relayer tidak dijalankan sebagai PID 1
CMD ["pm2-runtime", "start", "index.js", "--name", "oracle"]