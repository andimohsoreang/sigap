# syntax=docker/dockerfile:1
# Image Contact Center (Next.js, web/). Build dari ROOT repo:
#   docker compose -f deploy/next/compose.yml build
# Satu image untuk `web` dan `worker` (beda command). Butuh `output: 'standalone'` di web/next.config.*.
# Berkas yang ikut konteks diatur deploy/next/Dockerfile.dockerignore (hanya web/).

# Dipin ke digest (manifest list multi-arch) node:24.22.3-trixie-slim, 12 Nov 2026.
# glibc dipilih karena binary prebuilt SWC & sharp untuk linux-x64-gnu; cek di server tanpa AVX
# dengan scripts/cek-binary-native.sh sebelum dipakai.
ARG NODE_IMAGE=node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0

# ---------- Dependensi ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------- Build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# NEXT_PUBLIC_* ditanam ke JavaScript saat build: tambahkan di sini sebagai ARG hanya untuk nilai
# publik. Rahasia TIDAK PERNAH lewat ARG/ENV di Dockerfile — tersimpan di riwayat layer.
RUN npm run build \
 && { test -f .next/standalone/server.js || { echo "Tidak ada .next/standalone: set output: 'standalone' di web/next.config" >&2; exit 1; }; } \
 && mkdir -p public

# ---------- Runtime ----------
FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.title="contact-center-web"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Berkas aplikasi milik root (tidak bisa diubah proses). Yang ditulis saat jalan hanya
# .next/cache dan /tmp — di compose dipasang tmpfs karena root filesystem read-only.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
# /up = liveness (rencana §9.5). Node bawaan, tanpa curl di image.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/up').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
