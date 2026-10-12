<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Services\RecaptchaService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePengaduanInternalRequest extends FormRequest
{
    use VerifiesRecaptcha;

    protected function recaptchaAction(): string
    {
        return RecaptchaService::ACTION_PENGADUAN_INTERNAL;
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'nip' => ['required', 'string', 'max:30'],
            'nama' => ['required', 'string', 'max:150'],
            'unit' => ['required', 'string', 'max:120'],
            'kontak' => ['required', 'string', 'max:30'],
            'kategori' => ['required', 'string', 'max:120'],
            'urgensi' => ['required', Rule::in(['Rendah', 'Sedang', 'Tinggi', 'Kritis'])],
            'lokasi' => ['required', 'string', 'max:150'],
            'deskripsi' => ['required', 'string', 'min:10'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            ...$this->recaptchaRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nip.required' => 'NIP / ID pegawai wajib diisi.',
            'unit.required' => 'Unit / bagian wajib dipilih.',
            'urgensi.required' => 'Tingkat urgensi wajib dipilih.',
            'lokasi.required' => 'Lokasi / ruangan wajib diisi.',
            'deskripsi.min' => 'Deskripsi masalah minimal 10 karakter.',
        ];
    }

    /** Petakan urgensi internal ke tingkat dampak publik. */
    public function impact(): string
    {
        return strtolower($this->validated('urgensi'));
    }
}
