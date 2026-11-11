<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Models\Ticket;
use App\Services\RecaptchaService;
use App\Support\SurveyQuestionnaire;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Survei kepuasan — dipakai jalur Web (`/lacak/survei`, field `ticket`) dan
 * API (`/api/v1/survei/{ticket_no}`, nomor dari URL).
 */
class StoreSurveyRequest extends FormRequest
{
    use VerifiesRecaptcha;

    protected function recaptchaAction(): string
    {
        return RecaptchaService::ACTION_SURVEI;
    }

    /** Nomor tiket dari URL (API) atau field `ticket` (Web), dinormalisasi. */
    public function ticketNo(): string
    {
        return Ticket::normalizeNo($this->route('ticket_no') ?? $this->input('ticket'));
    }

    /** Kode akses (wajib bagi tamu untuk nomor format lama `TKT-<n>`). */
    public function accessCode(): ?string
    {
        $code = $this->input('kode');

        return is_string($code) ? $code : null;
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $scale = ['required', 'integer', 'between:1,4'];
        $optional = fn (array $choices) => ['nullable', 'string', Rule::in(array_keys($choices))];

        return [
            'ticket' => [$this->route('ticket_no') === null ? 'required' : 'nullable', 'string', 'max:32'],
            'kode' => ['nullable', 'string', 'max:16'],
            'jawaban' => ['required', 'array'],
            ...collect(array_keys(SurveyQuestionnaire::ASPECTS))->mapWithKeys(fn (string $key) => ["jawaban.{$key}" => $scale])->all(),
            'keseluruhan' => $scale,
            'teratasi' => ['required', 'string', Rule::in(array_keys(SurveyQuestionnaire::RESOLVED['pilihan']))],
            'kembali' => $scale,
            'tinjau_ulang' => ['boolean'],
            'baik' => ['nullable', 'string', 'max:1000'],
            'perbaikan' => ['nullable', 'string', 'max:1000'],
            'usia' => $optional(SurveyQuestionnaire::PROFILE['age_group']['pilihan']),
            'pendidikan' => $optional(SurveyQuestionnaire::PROFILE['education']['pilihan']),
            'pekerjaan' => $optional(SurveyQuestionnaire::PROFILE['occupation']['pilihan']),
            ...$this->recaptchaRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'jawaban.*.required' => 'Pilih satu jawaban untuk pertanyaan ini.',
            'jawaban.*.between' => 'Jawaban harus bernilai 1 sampai 4.',
            'keseluruhan.required' => 'Pilih tingkat kepuasan Anda secara keseluruhan.',
            'teratasi.required' => 'Pilih apakah masalah Anda sudah teratasi.',
            'kembali.required' => 'Pilih kemungkinan Anda menggunakan Contact Center lagi.',
        ];
    }
}
