<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Verifikasi reCAPTCHA server-side (PRD SEC-10).
 *
 * Klien mengirim `recaptcha_token`; token diverifikasi ke Google sebelum data
 * disimpan. Bila `services.recaptcha.secret` kosong maka verifikasi dilewati
 * (pengembangan lokal tanpa kunci). Bila verifikasi gagal karena gangguan
 * jaringan, permintaan DITOLAK demi keamanan namun dicatat di log.
 */
class RecaptchaService
{
    public function enabled(): bool
    {
        return ! empty(config('services.recaptcha.secret'));
    }

    /** @return bool true bila token valid, atau bila verifikasi tidak aktif. */
    public function verify(?string $token, ?string $ip = null): bool
    {
        if (! $this->enabled()) {
            return true;
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

            $data = $response->json();

            if (! ($data['success'] ?? false)) {
                return false;
            }

            // reCAPTCHA v3: periksa skor minimum.
            if (isset($data['score']) && $data['score'] < (float) config('services.recaptcha.min_score')) {
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('reCAPTCHA: verifikasi gagal — '.$e->getMessage());

            return false;
        }
    }
}