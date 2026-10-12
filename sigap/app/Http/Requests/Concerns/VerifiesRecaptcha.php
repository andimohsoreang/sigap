<?php

namespace App\Http\Requests\Concerns;

use App\Services\RecaptchaService;
use Illuminate\Contracts\Validation\Validator;

/**
 * Verifikasi reCAPTCHA v3 sebagai bagian dari validasi FormRequest (A-04).
 *
 * Pesan error konsisten untuk jalur Web (Inertia) maupun API. Keputusan
 * lolos/tidak sepenuhnya di RecaptchaService (fail closed di production).
 * Kelas pemakai wajib mendefinisikan recaptchaAction().
 */
trait VerifiesRecaptcha
{
    abstract protected function recaptchaAction(): string;

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            // Bila field lain sudah gagal, tidak perlu memanggil Google.
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $ok = app(RecaptchaService::class)->verify(
                $this->input('recaptcha_token'),
                $this->ip(),
                $this->recaptchaAction(),
            );

            if (! $ok) {
                $validator->errors()->add('recaptcha_token', 'Verifikasi reCAPTCHA gagal. Silakan muat ulang halaman dan coba lagi.');
            }
        });
    }

    /** @return array<string, array<int, string>> */
    protected function recaptchaRules(): array
    {
        return ['recaptcha_token' => ['nullable', 'string', 'max:4096']];
    }
}
