<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Models\User;
use App\Services\RecaptchaService;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Pendaftaran mandiri akun warga: NIK, nama, surel (wajib, diverifikasi),
 * telepon opsional, kata sandi minimal 8 karakter berisi huruf & angka
 * (sama dengan aturan ganti sandi di Portal Warga, A-09).
 */
class RegisterWargaRequest extends FormRequest
{
    use VerifiesRecaptcha;

    public function authorize(): bool
    {
        return true;
    }

    protected function recaptchaAction(): string
    {
        return RecaptchaService::ACTION_DAFTAR;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nik' => trim((string) $this->input('nik')),
            'email' => mb_strtolower(trim((string) $this->input('email'))),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'nik' => [
                'required', 'digits:16',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (User::findByNik((string) $value) !== null) {
                        $fail('NIK ini sudah terdaftar. Silakan masuk, atau gunakan Lupa kata sandi.');
                    }
                },
            ],
            'nama' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telepon' => ['nullable', 'string', 'max:30', 'regex:/^(\+?62|0)8[\d\s.-]{7,15}$/'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers()],
            'setuju' => ['accepted'],
            ...$this->recaptchaRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nik.required' => 'NIK wajib diisi.',
            'nik.digits' => 'NIK harus 16 digit angka.',
            'nama.required' => 'Nama lengkap wajib diisi.',
            'email.required' => 'Email wajib diisi untuk verifikasi akun dan atur ulang kata sandi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah dipakai akun lain.',
            'telepon.regex' => 'Nomor telepon harus diawali 08 atau 62.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
            'setuju.accepted' => 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi.',
        ];
    }
}
