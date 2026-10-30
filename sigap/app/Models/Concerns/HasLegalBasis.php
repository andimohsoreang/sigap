<?php

namespace App\Models\Concerns;

use Illuminate\Support\Carbon;

/**
 * Dasar hukum Sumber Resmi atau artikel (PRD-AI FR-AI-11). Labelnya dikirim
 * ke model bersama setiap sumber, sehingga model memilih aturan yang berlaku
 * dari label yang diisi petugas — bukan dengan menebak dari tahun.
 *
 * @property string|null $dasar_hukum
 * @property Carbon|null $tanggal_dasar
 * @property string $status_dasar
 * @property string|null $diganti_oleh
 */
trait HasLegalBasis
{
    public const DASAR_BERLAKU = 'berlaku';

    public const DASAR_DIGANTI = 'diganti';

    public const DASAR_BELUM_DIKETAHUI = 'belum_diketahui';

    public const STATUS_DASAR = [self::DASAR_BERLAKU, self::DASAR_DIGANTI, self::DASAR_BELUM_DIKETAHUI];

    /** Kolom yang diisi petugas di formulir. */
    public const LEGAL_BASIS_FIELDS = ['dasar_hukum', 'tanggal_dasar', 'status_dasar', 'diganti_oleh'];

    public function initializeHasLegalBasis(): void
    {
        $this->mergeFillable(self::LEGAL_BASIS_FIELDS);
        $this->mergeCasts(['tanggal_dasar' => 'date']);
    }

    /** Label untuk model, mis. "Dasar: Permentrans 3/2026 (2026) — BERLAKU". */
    public function legalBasisLabel(): string
    {
        $basis = filled($this->dasar_hukum) ? trim($this->dasar_hukum) : 'tidak dicatat';
        if ($this->tanggal_dasar !== null) {
            $basis .= " ({$this->tanggal_dasar->year})";
        }

        $status = match ($this->status_dasar) {
            self::DASAR_BERLAKU => 'BERLAKU',
            self::DASAR_DIGANTI => 'DIGANTI'.(filled($this->diganti_oleh) ? ' oleh '.trim($this->diganti_oleh) : ''),
            default => 'BELUM DIKETAHUI',
        };

        return "Dasar: {$basis} — {$status}";
    }

    /** Aturan validasi formulir (dipakai controller artikel & Sumber Resmi). */
    public static function legalBasisRules(): array
    {
        return [
            'dasar_hukum' => ['nullable', 'string', 'max:255'],
            'tanggal_dasar' => ['nullable', 'date'],
            'status_dasar' => ['sometimes', 'required', 'in:'.implode(',', self::STATUS_DASAR)],
            'diganti_oleh' => ['nullable', 'string', 'max:255', 'required_if:status_dasar,'.self::DASAR_DIGANTI],
        ];
    }

    /** @return array{dasar_hukum: string|null, tanggal_dasar: string|null, status_dasar: string, diganti_oleh: string|null} */
    public function legalBasisRow(): array
    {
        return [
            'dasar_hukum' => $this->dasar_hukum,
            'tanggal_dasar' => $this->tanggal_dasar?->toDateString(),
            'status_dasar' => $this->status_dasar ?? self::DASAR_BELUM_DIKETAHUI,
            'diganti_oleh' => $this->diganti_oleh,
        ];
    }
}
