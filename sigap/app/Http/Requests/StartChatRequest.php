<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Services\RecaptchaService;
use App\Support\Provinces;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Tamu memulai live chat dengan mengisi nama (warga login tidak perlu). */
class StartChatRequest extends FormRequest
{
    use VerifiesRecaptcha;

    protected function recaptchaAction(): string
    {
        return RecaptchaService::ACTION_CHAT;
    }

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $nama = preg_replace('/\s+/u', ' ', trim((string) $this->input('nama')));
        $this->merge(['nama' => $nama]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // Huruf (termasuk aksen), spasi, titik, koma, apostrof, tanda hubung.
            // Warga yang login memakai nama akunnya; tamu wajib mengisi nama.
            'nama' => [Rule::requiredIf(! $this->user()), 'nullable', 'string', 'min:2', 'max:100', "regex:/^[\\pL\\pM][\\pL\\pM .,'’-]*$/u"],
            // Asal pengaduan: provinsi (wajib di kartu Kenalan) + kabupaten/kawasan/desa.
            'provinsi' => ['nullable', 'string', Rule::in(Provinces::ALL)],
            'lokasi' => ['nullable', 'string', 'max:150'],
            ...$this->recaptchaRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama wajib diisi.',
            'nama.min' => 'Nama minimal 2 huruf.',
            'nama.max' => 'Nama maksimal 100 karakter.',
            'nama.regex' => 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.',
            'provinsi.in' => 'Pilih provinsi dari daftar.',
            'lokasi.max' => 'Lokasi maksimal 150 karakter.',
        ];
    }
}
