<?php

namespace App\Http\Requests;

use App\Enums\TicketImpact;
use App\Enums\TicketVisibility;
use App\Enums\UserRole;
use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Models\User;
use App\Services\RecaptchaService;
use App\Support\Coordinates;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePengaduanRequest extends FormRequest
{
    use VerifiesRecaptcha;

    public function authorize(): bool
    {
        return true; // laporan publik boleh tanpa login
    }

    protected function recaptchaAction(): string
    {
        return RecaptchaService::ACTION_PENGADUAN;
    }

    /** Id akun warga yang sedang login (hanya peran warga), atau null. */
    public function reporterId(?User $user): ?int
    {
        return $user !== null && $user->role === UserRole::Warga ? $user->id : null;
    }

    /**
     * Koordinat "lat, lng" yang sudah tervalidasi (A-15).
     *
     * @return array{0: float|null, 1: float|null}
     */
    public function coordinates(): array
    {
        return Coordinates::parse($this->validated('koordinat'));
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
            'koordinat' => ['nullable', 'string', 'max:100', Coordinates::rule()],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'impact' => ['required', Rule::enum(TicketImpact::class)],
            'visibility' => ['nullable', Rule::enum(TicketVisibility::class)],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
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
            'judul.required' => 'Judul laporan wajib diisi.',
            'uraian.required' => 'Uraian laporan wajib diisi.',
            'uraian.min' => 'Uraian aduan minimal 10 karakter.',
            'impact.required' => 'Tingkat dampak wajib dipilih.',
            'attachment.mimes' => 'Lampiran harus berupa JPG, PNG, atau PDF.',
            'attachment.max' => 'Ukuran lampiran maksimal 5 MB.',
        ];
    }
}
