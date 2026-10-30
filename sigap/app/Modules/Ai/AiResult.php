<?php

namespace App\Modules\Ai;

/**
 * Hasil {@see AiGateway::run()}.
 *
 * - `ok`       : model menjawab, `data` sudah divalidasi skema tugas
 * - `fallback` : model menjawab tetapi keluarannya tidak sah (JSON rusak)
 * - `skipped`  : model tidak dipanggil (sirkuit terbuka, anggaran habis, batas percakapan)
 * - `error`    : penyedia gagal (setelah coba ulang)
 *
 * Selain `ok`, pemanggil memakai jalur cadangan tanpa model. `callId` menunjuk
 * baris `ai_calls` panggilan yang berhasil, agar pemanggil dapat menandainya
 * ditolak ({@see AiGateway::reject()}).
 */
final readonly class AiResult
{
    public const OK = 'ok';

    public const FALLBACK = 'fallback';

    public const SKIPPED = 'skipped';

    public const ERROR = 'error';

    /** @param  array<string, mixed>  $data */
    private function __construct(
        public string $status,
        public array $data = [],
        public ?string $reason = null,
        public ?int $callId = null,
    ) {}

    /** @param  array<string, mixed>  $data */
    public static function ok(array $data, ?int $callId = null): self
    {
        return new self(self::OK, $data, null, $callId);
    }

    public static function fallback(string $reason): self
    {
        return new self(self::FALLBACK, [], $reason);
    }

    public static function skipped(string $reason): self
    {
        return new self(self::SKIPPED, [], $reason);
    }

    public static function error(string $reason): self
    {
        return new self(self::ERROR, [], $reason);
    }

    public function isOk(): bool
    {
        return $this->status === self::OK;
    }
}
