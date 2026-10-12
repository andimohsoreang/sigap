<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Verifikasi reCAPTCHA v3 server-side (PRD SEC-10, A-04).
 *
 * Klien mengirim `recaptcha_token`; token diverifikasi ke Google sebelum data
 * disimpan:
 * - `success` harus true, `score` >= `services.recaptcha.min_score`, dan
 *   `action` (bila dikirim Google) harus sama dengan aksi yang diharapkan.
 * - FAIL CLOSED: bila `services.recaptcha.secret` kosong di lingkungan
 *   production, permintaan DITOLAK. Verifikasi hanya boleh dilewati di
 *   lingkungan local/testing (pengembangan tanpa kunci).
 * - Gangguan jaringan/HTTP ke Google juga ditolak (dicatat di log).
 */
class RecaptchaService
{
    /** Aksi reCAPTCHA v3 yang dipakai klien. */
    public const ACTION_PENGADUAN = 'pengaduan';

    public const ACTION_PENGADUAN_INTERNAL = 'pengaduan_internal';

    public const ACTION_SURVEI = 'survei';

    public const ACTION_CHAT = 'chat';

    public function enabled(): bool
    {
        return ! empty(config('services.recaptcha.secret'));
    }

    /** Verifikasi boleh dilewati hanya di local/testing tanpa kunci. */
    public function canSkip(): bool
    {
        return ! $this->enabled() && app()->environment(['local', 'testing']);
    }

    /** @return bool true bila token valid, atau bila verifikasi boleh dilewati. */
    public function verify(?string $token, ?string $ip = null, ?string $action = null): bool
    {
        if (! $this->enabled()) {
            if ($this->canSkip()) {
                return true;
            }

            Log::error('reCAPTCHA: RECAPTCHA_SECRET_KEY kosong di lingkungan '.app()->environment().' — permintaan ditolak.');

            return false;
        }

        if (empty($token)) {
            return false;
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->post((string) config('services.recaptcha.verify_url'), [
                    'secret' => config('services.recaptcha.secret'),
                    'response' => $token,
                    'remoteip' => $ip,
                ]);

            if (! $response->ok()) {
                Log::warning('reCAPTCHA: respons tidak OK (HTTP '.$response->status().').');

                return false;
            }

            $data = (array) $response->json();

            if (! ($data['success'] ?? false)) {
                return false;
            }

            // reCAPTCHA v3: skor wajib ada dan memenuhi ambang minimum.
            if (! isset($data['score']) || (float) $data['score'] < (float) config('services.recaptcha.min_score', 0.5)) {
                return false;
            }

            if ($action !== null && isset($data['action']) && $data['action'] !== $action) {
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('reCAPTCHA: verifikasi gagal — '.$e->getMessage());

            return false;
        }
    }
}
