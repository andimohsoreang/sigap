<?php

namespace App\Http\Requests;

use App\Enums\TicketImpact;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInputManualRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sumber_laporan' => ['required', Rule::in([
                'tatap_muka', 'call_center', 'surat', 'instagram', 'x', 'facebook', 'tiktok',
            ])],
            'admin_penerima' => ['nullable', 'string', 'max:150'],
            'nik' => ['nullable', 'digits:16'],
            'nama' => ['required', 'string', 'max:150'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'tautan' => ['nullable', 'url', 'max:500'],
            'judul' => ['required', 'string', 'max:255'],
            'uraian' => ['required', 'string', 'min:10'],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'impact' => ['required', Rule::enum(TicketImpact::class)],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ];
    }
}