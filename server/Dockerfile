# Base image: Node.js 20 (Alpine untuk ukuran kecil)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Salin seluruh source code server (zero external dependency)
COPY . .

# Expose port (default 8787, bisa di-override lewat PORT env)
EXPOSE 8787

# Jalankan server
CMD ["node", "src/index.js"]
