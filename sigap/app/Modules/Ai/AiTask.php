<?php

namespace App\Modules\Ai;

use App\Modules\Ai\Prompts\JawabPrompt;
use App\Modules\Ai\Prompts\SaranTiketPrompt;
use App\Modules\Ai\Prompts\UsulArtikelPrompt;

/** Tugas AI yang dilayani {@see AiGateway} (PRD-AI FR-AI-01). */
enum AiTask: string
{
    case Jawab = 'jawab';
    case UsulArtikel = 'usul_artikel';
    case SaranTiket = 'saran_tiket';

    public function systemPrompt(): string
    {
        return match ($this) {
            self::Jawab => JawabPrompt::system(),
            self::UsulArtikel => UsulArtikelPrompt::system(),
            self::SaranTiket => SaranTiketPrompt::system(),
        };
    }

    public function promptVersion(): string
    {
        return match ($this) {
            self::Jawab => JawabPrompt::VERSION,
            self::UsulArtikel => UsulArtikelPrompt::VERSION,
            self::SaranTiket => SaranTiketPrompt::VERSION,
        };
    }

    /** Kunci `services.ai.models.*` untuk model khusus tugas (FR-AI-09); null = `AI_MODEL`. */
    public function modelKey(): ?string
    {
        return match ($this) {
            self::Jawab => null,
            self::UsulArtikel => 'usul_artikel',
            self::SaranTiket => 'saran_tiket',
        };
    }

    /**
     * Kunci masukan tingkat atas yang TIDAK disamarkan karena berisi konten
     * resmi/terkurasi (bukan teks warga), mis. kutipan sumber yang memuat
     * nomor hotline resmi. Semua teks lain disamarkan (FR-AI-10).
     *
     * @return list<string>
     */
    public function trustedInput(): array
    {
        return match ($this) {
            self::Jawab => ['sumber', 'portal'],
            self::UsulArtikel => [],
            self::SaranTiket => ['kawasan', 'kategori'],
        };
    }

    /** Validator keluaran: objek JSON dengan bentuk dasar tugas. */
    public function accepts(array $data): bool
    {
        return match ($this) {
            self::Jawab, self::SaranTiket => true,
            self::UsulArtikel => ! isset($data['usulan']) || is_array($data['usulan']),
        };
    }
}
