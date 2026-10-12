<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Ubah profil & kata sandi warga — dipakai jalur Web (portal warga) dan API.
 *
 * A-09: ganti kata sandi wajib menyertakan `current_password` yang benar,
 * konfirmasi (`password_confirmation`) dan minimal 8 karakter berisi huruf &
 * angka. A-10: email harus unik (mengabaikan akun sendiri).
 */
class UpdateWargaProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $user = $this->user();

        return [
            'email' => [
                'nullable', 'email', 'max:150',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'telp' => ['nullable', 'string', 'max:30'],
            'current_password' => [
                'nullable', 'required_with:password', 'string',
                function (string $attribute, mixed $value, Closure $fail) use ($user): void {
                    if ($value !== null && ($user === null || ! Hash::check((string) $value, $user->password))) {
                        $fail('Kata sandi saat ini tidak sesuai.');
                    }
                },
            ],
            'password' => [
                'nullable', 'string', 'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'email.unique' => 'Email sudah dipakai akun lain.',
            'current_password.required_with' => 'Masukkan kata sandi saat ini untuk mengganti kata sandi.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ];
    }
}
