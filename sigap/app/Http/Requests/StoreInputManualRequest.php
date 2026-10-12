<?php

namespace App\Http\Requests;

use App\Enums\TicketImpact;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Input manual tiket oleh petugas (kanal offline/medsos) — Web & API.
 */
class StoreInputManualRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * A-11: kawasan admin kawasan dipaksa dari akunnya sebelum validasi,
     * sehingga form tidak perlu (dan tidak dapat) memilih kawasan lain.
     */
    protected function prepareForValidation(): void
    {
        $user = $this->user();

        if ($user instanceof User && $user->role === UserRole::AdminKawasan) {
            $this->merge(['region_id' => $user->region_id]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sumber_laporan' => ['required', Rule::in([
                'tatap_muka', 'call_center', 'surat', 'instagram', 'x', 'facebook', 'tiktok',
            ])],
            'nik' => ['nullable', 'digits:16'],
            'nama' => ['required', 'string', 'max:150'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'tautan' => ['nullable', 'url:http,https', 'max:500'],
            'judul' => ['required', 'string', 'max:255'],
            'uraian' => ['required', 'string', 'min:10'],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'impact' => ['required', Rule::enum(TicketImpact::class)],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ];
    }

    /**
     * Data untuk TicketService::create (A-11).
     *
     * Admin kawasan SELALU memakai kawasannya sendiri (region_id kiriman
     * diabaikan) agar tidak dapat menerbitkan tiket ke kawasan lain.
     *
     * @return array<string, mixed>
     */
    public function ticketData(User $actor): array
    {
        $data = $this->validated();

        $regionId = $actor->role === UserRole::AdminKawasan
            ? $actor->region_id
            : $data['region_id'];

        return [
            'title' => $data['judul'],
            'description' => $data['uraian'],
            'impact' => $data['impact'],
            'region_id' => $regionId,
            'category_id' => $data['category_id'],
            'attachment' => $this->file('attachment'),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            'source' => $data['sumber_laporan'],
            'source_url' => $data['tautan'] ?? null,
            // Admin penerima SELALU akun yang login (nilai kiriman klien diabaikan).
            'received_by' => $actor->name,
            'actor_id' => $actor->id,
        ];
    }
}
