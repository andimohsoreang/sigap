<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\VerifiesRecaptcha;
use App\Models\Ticket;
use App\Services\RecaptchaService;
use Illuminate\Foundation\Http\FormRequest;

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
        return [
            'ticket' => [$this->route('ticket_no') === null ? 'required' : 'nullable', 'string', 'max:32'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'kode' => ['nullable', 'string', 'max:16'],
            ...$this->recaptchaRules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'rating.between' => 'Penilaian harus antara 1 sampai 5 bintang.',
        ];
    }
}
