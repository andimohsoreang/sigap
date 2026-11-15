#!/usr/bin/env bash
# Sandbox Docker untuk skill `security-audit` (paket J, docs/slices/S0-gelombang2.md): menjalankan SATU perintah
# terhadap salinan read-only sebuah worktree, tanpa jaringan, tanpa hak istimewa, dengan batas CPU/memori/proses
# dan batas waktu dinding. Hasil (laporan, SARIF, dst.) ditulis perintah ke /scratch — satu-satunya mount rw.
#
#   bash scripts/sandbox-audit.sh [opsi] <worktree> <dir-scratch> -- <perintah> [arg...]
#     --image <ref@sha256:…>  image tempat perintah berjalan (wajib dipin digest; default: Node image web)
#     --timeout <detik>       batas waktu dinding (default 1800); lewat batas → container di-kill, exit 124
#     --env <NAMA>            teruskan variabel dari env pemanggil; hanya nama di IZIN_ENV
#     --rencana               tampilkan snapshot & perintah docker tanpa menjalankannya (boleh tanpa Docker)
#   Contoh: bash scripts/sandbox-audit.sh ~/wt/legacy /srv/audit/legacy -- \
#             sh -c 'grep -rn "eval(" /src/web/src > /scratch/eval.txt'
#
# Di mana dijalankan: TIDAK di laptop (tanpa Docker). Dua pilihan, keduanya Linux dengan Docker:
#   - server, lewat SSH dan HANYA dengan persetujuan pemilik proyek per sesi audit, dari clone /opt/cc-uji:
#       ssh srvr-dev-andy 'cd /opt/cc-uji && bash scripts/sandbox-audit.sh <worktree> <scratch> -- <perintah>'
#     (worktree yang diaudit disalin dulu ke server, mis. `git bundle`/rsync ke folder audit milik user deploy);
#   - runner CI Linux (ubuntu-24.04 punya Docker), sebagai job sekali pakai.
# Image harus sudah ada di cache Docker (`--pull never`): menarik image adalah langkah terpisah yang disetujui.
#
# Isolasi: --network none, --read-only, tmpfs /tmp (noexec tidak dipakai: banyak alat menulis lalu menjalankan
# di /tmp), --cpus 2, --memory 4g tanpa swap, --pids-limit 512, no-new-privileges, --cap-drop ALL, user pemanggil
# (bukan root), env kosong + allowlist, HOME=/tmp. Snapshot = berkas terlacak + tak terlacak yang tidak di-ignore
# (`git ls-files -co --exclude-standard`): .env, node_modules, .next, dan berkas ignore lain TIDAK ikut; .git juga
# tidak (riwayat git tidak tersedia di sandbox).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IZIN_ENV=(TZ LANG LC_ALL NO_COLOR)
IMAGE="$(sed -nE 's/^ARG NODE_IMAGE=(.+)$/\1/p' "$ROOT/deploy/next/Dockerfile")"
BATAS=1800; RENCANA=0; ENVS=()

die() { echo "GAGAL: $*" >&2; exit 1; }
pakai() { sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="${2:?}"; shift 2 ;;
    --timeout) BATAS="${2:?}"; shift 2 ;;
    --env)
      n="${2:?}"; shift 2
      [[ " ${IZIN_ENV[*]} " == *" $n "* ]] || die "--env $n tidak di allowlist (${IZIN_ENV[*]})"
      ENVS+=(-e "$n") ;;
    --rencana) RENCANA=1; shift ;;
    -h|--help) pakai ;;
    --) die "<worktree> dan <dir-scratch> wajib sebelum --" ;;
    -*) die "opsi tidak dikenal: $1" ;;
    *) break ;;
  esac
done
[[ $# -ge 4 && "$3" == "--" ]] || pakai
WT="$(cd "$1" && pwd -P)" || die "worktree tidak ada: $1"
# Path absolut scratch tanpa membuatnya dulu (dibuat setelah lolos validasi).
if [[ -d "$2" ]]; then SCRATCH="$(cd "$2" && pwd -P)"
else SCRATCH="$(cd "$(dirname "$2")" && pwd -P)/$(basename "$2")" || die "induk scratch tidak ada: $2"; fi
shift 3

[[ "$BATAS" =~ ^[1-9][0-9]*$ ]] || die "--timeout harus bilangan detik"
[[ "$IMAGE" == *@sha256:* ]] || die "image harus dipin digest (…@sha256:…): $IMAGE"
git -C "$WT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$WT bukan worktree git"
# Scratch tidak boleh berada di dalam worktree atau sebaliknya: mount rw tidak boleh menyentuh kode yang diaudit.
case "$SCRATCH/" in "$WT/"*) die "scratch di dalam worktree" ;; esac
case "$WT/" in "$SCRATCH/"*) die "worktree di dalam scratch" ;; esac
[[ "$SCRATCH" != / && "$SCRATCH" != "$HOME" ]] || die "scratch terlalu luas: $SCRATCH"

NAMA="cc-audit-$$"
if [[ $RENCANA -eq 1 ]]; then
  SNAP="<snapshot-sementara>"
else
  command -v docker >/dev/null 2>&1 || die "docker tidak ditemukan — sandbox hanya untuk server/runner Linux dengan Docker"
  docker info >/dev/null 2>&1 || die "tidak bisa menghubungi daemon Docker"
  docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image belum ada di cache: $IMAGE (pull dulu, dengan persetujuan)"
  mkdir -p "$SCRATCH" && chmod 700 "$SCRATCH"
  SNAP="$(mktemp -d "${TMPDIR:-/tmp}/cc-audit.XXXXXX")"
  bersih() { docker rm -f "$NAMA" >/dev/null 2>&1 || true; rm -rf "$SNAP"; }
  trap bersih EXIT
  trap 'exit 130' INT TERM
fi

DOCKER=(docker run --name "$NAMA" -d --pull never
  --network none --read-only --tmpfs /tmp:rw,nosuid,nodev,size=1g
  --cpus 2 --memory 4g --memory-swap 4g --pids-limit 512
  --security-opt no-new-privileges --cap-drop ALL
  --user "$(id -u):$(id -g)" -e HOME=/tmp ${ENVS[@]+"${ENVS[@]}"}
  -v "$SNAP:/src:ro" -v "$SCRATCH:/scratch:rw" -w /src
  "$IMAGE" "$@")

if [[ $RENCANA -eq 1 ]]; then
  echo "Snapshot: $(git -C "$WT" ls-files -co --exclude-standard | wc -l | tr -d ' ') berkas dari $WT"
  echo "Batas waktu: ${BATAS} dtk"
  printf 'Perintah:'; printf ' %q' "${DOCKER[@]}"; echo
  exit 0
fi

# Berkas yang terhapus di working tree tetap terdaftar di index → disaring.
git -C "$WT" ls-files -z -co --exclude-standard \
  | while IFS= read -r -d '' f; do [[ -e "$WT/$f" || -L "$WT/$f" ]] && printf '%s\0' "$f"; done \
  | tar -C "$WT" --null -T - -cf - | tar -C "$SNAP" -xf -

echo "==> Sandbox $NAMA: $(find "$SNAP" -type f | wc -l | tr -d ' ') berkas, batas ${BATAS} dtk, image $IMAGE"
"${DOCKER[@]}" >/dev/null
mulai=$SECONDS
( sleep "$BATAS"; docker kill "$NAMA" >/dev/null 2>&1 && echo "==> TIMEOUT ${BATAS} dtk — container di-kill" >&2 ) &
PENJAGA=$!
docker logs -f "$NAMA" 2>&1 || true
kode="$(docker wait "$NAMA")"
kill "$PENJAGA" 2>/dev/null || true
(( SECONDS - mulai < BATAS )) || kode=124

echo "==> Selesai, exit $kode. Berkas baru di $SCRATCH:"
find "$SCRATCH" -type f -newer "$SNAP" -exec ls -l {} + 2>/dev/null || true
exit "$kode"
