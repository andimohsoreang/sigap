<?php

namespace App\Http\Requests;

use App\Enums\TicketImpact;
use App\Enums\TicketVisibility;
use App\Services\RecaptchaService;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePengaduanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // laporan publik boleh tanpa login
    }

    /**
     * Verifikasi reCAPTCHA server-side (PRD SEC-10).
     *
     * Diverifikasi sebagai bagian dari validasi sehingga pesan error konsisten
     * untuk jalur Web (Inertia) maupun API. Otomatis dilewati bila kunci
     * reCAPTCHA belum dikonfigurasi.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! app(RecaptchaService::class)->verify($this->input('recaptcha_token'), $this->ip())) {
                $validator->errors()->add('recaptcha_token', 'Verifikasi reCAPTCHA gagal. Silakan coba lagi.');
            }
        });
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'nik' => ['required', 'digits:16'],
            'nama' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'judul' => ['required', 'string', 'max:255'],
            'uraian' => ['required', 'string', 'min:10'],
            'koordinat' => ['nullable', 'string', 'max:100'],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'impact' => ['required', Rule::enum(TicketImpact::class)],
            'visibility' => ['nullable', Rule::enum(TicketVisibility::class)],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'recaptcha_token' => ['nullable', 'string'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nik.required' => 'NIK wajib diisi.',
            'nik.digits' => 'NIK harus 16 digit angka.',
            'nama.required' => 'Nama lengkap wajib diisi.',
            'judul.required' => 'Judul laporan wajib diisi.',
            'uraian.required' => 'Uraian laporan wajib diisi.',
            'uraian.min' => 'Uraian aduan minimal 10 karakter.',
            'impact.required' => 'Tingkat dampak wajib dipilih.',
            'attachment.mimes' => 'Lampiran harus berupa JPG, PNG, atau PDF.',
            'attachment.max' => 'Ukuran lampiran maksimal 5 MB.',
        ];
    }
}