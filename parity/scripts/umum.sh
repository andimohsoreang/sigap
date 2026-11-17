# Bagian bersama target paritas (di-source laravel.sh & next.sh, bukan dijalankan sendiri): penjaga sigap/ =
# laravel-baseline, env cermin produksi (env/laravel.env), kunci acak per run, seed `sigap:e2e-setup`, dan
# penjaga server yatim. Kedua target memakai kode seed Laravel yang sama → data uji identik.

PARITY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGAP="$(cd "$PARITY/../sigap" && pwd)"
ENV_FILE="$PARITY/env/laravel.env"

gagal() { echo "$(basename "$0"): $*" >&2; exit 1; }

# Port terpakai = biasanya server yatim dari run sebelumnya; jangan diam-diam diuji ke server itu.
port_bebas() {
    if (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; then
        gagal "port $1 sudah dipakai (server sisa run sebelumnya?): lsof -ti tcp:$1 | xargs kill"
    fi
}

# Kode Laravel yang menyemai data harus persis tag laravel-baseline (kecuali perintah fixture cc: dan README).
cek_sigap_baseline() {
    [ -d "$SIGAP/vendor" ] || gagal "sigap/vendor belum ada: jalankan 'composer install' di sigap/"
    git -C "$SIGAP" rev-parse -q --verify 'laravel-baseline^{commit}' >/dev/null || gagal "tag laravel-baseline tidak ada: git fetch --tags"
    local exclude=(':(exclude)app/Console/Commands/Cc' ':(exclude)README.md')
    git -C "$SIGAP" diff --quiet laravel-baseline -- . "${exclude[@]}" || gagal "sigap/ berbeda dari laravel-baseline:
$(git -C "$SIGAP" diff --stat laravel-baseline -- . "${exclude[@]}")"
    local untracked
    untracked="$(git -C "$SIGAP" ls-files --others --exclude-standard -- . "${exclude[@]}")"
    [ -z "$untracked" ] || gagal "berkas tak terlacak di sigap/ (bukan bagian laravel-baseline):
$untracked"
}

# env/laravel.env + kunci acak per run (bukan rahasia produksi) + APP_URL target. PARITAS_DB mengganti database
# (mis. agar dua worktree tidak saling menimpa seed di cc_paritas); default dari env/laravel.env.
muat_env() {
    local port="$1"
    set -a
    # shellcheck source=../env/laravel.env
    . "$ENV_FILE"
    set +a
    DB_DATABASE="${PARITAS_DB:-$DB_DATABASE}"
    APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    NIK_HASH_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    APP_URL="http://127.0.0.1:${port}"
    SANCTUM_STATEFUL_DOMAINS="127.0.0.1:${port}"
    export DB_DATABASE APP_KEY NIK_HASH_KEY APP_URL SANCTUM_STATEFUL_DOMAINS
}

# migrate:fresh --seed + akun uji (kata sandi acak → sigap/storage/app/e2e/credentials.json). sigap:e2e-setup hanya mau
# jalan di APP_ENV local/testing; server Laravel tetap production.
seed_laravel() {
    (
        cd "$SIGAP"
        # Folder ini tidak ikut git (isinya di-.gitignore) pada worktree baru.
        mkdir -p storage/framework/views storage/framework/cache/data storage/framework/sessions storage/logs
        php artisan config:clear >/dev/null
        php artisan route:clear >/dev/null
        php artisan event:clear >/dev/null
        php artisan view:clear >/dev/null
        APP_ENV=local php artisan sigap:e2e-setup
    )
}

# Tunggu sampai proses server berhenti atau proses induk (runner Playwright) hilang tanpa sinyal; trap EXIT pemanggil
# mematikan server, agar tidak ada server yatim di port target.
tunggu_server() {
    local server="$1" parent="$2"
    while kill -0 "$server" 2>/dev/null && kill -0 "$parent" 2>/dev/null; do sleep 2; done
}
