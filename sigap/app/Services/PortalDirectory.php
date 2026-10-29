<?php

namespace App\Services;

use App\Models\Portal;
use App\Services\Knowledge\IndonesianText;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Katalog portal publik untuk asisten AI.
 *
 * Model menerima daftar portal publik yang aktif (portal internal tidak
 * pernah dikirim) beserta tanda `disarankan` dari pencocokan kata kunci,
 * lalu memilih paling banyak satu portal. Pilihan model divalidasi ulang di
 * {@see find()}, jadi kode karangan tidak pernah sampai ke warga.
 */
class PortalDirectory
{
    /** @return Collection<int, Portal> */
    public function publicPortals(): Collection
    {
        return Cache::remember(Portal::CACHE_KEY, now()->addMinutes(10), fn () => Portal::query()
            ->publicActive()
            ->orderBy('sort')
            ->orderBy('name')
            ->get());
    }

    public function find(?string $code): ?Portal
    {
        return $code ? $this->publicPortals()->firstWhere('code', $code) : null;
    }

    /**
     * @return list<array{kode: string, nama: string, layanan: string, disarankan: bool}>
     */
    public function forAssistant(string $question): array
    {
        $suggested = $this->suggest($question)?->code;

        return $this->publicPortals()->map(fn (Portal $p) => [
            'kode' => $p->code,
            'nama' => $p->name,
            'layanan' => Str::limit($p->purpose.($p->description ? '. '.$p->description : ''), 300),
            'disarankan' => $p->code === $suggested,
        ])->values()->all();
    }

    /**
     * Portal yang paling cocok menurut kata kunci (tanpa model). Nama portal
     * yang disebut langsung ("trans tuntas", "sibarduktrans") bernilai lebih.
     */
    public function suggest(string $question): ?Portal
    {
        // Kata yang ada di hampir semua portal ("Kementerian Transmigrasi")
        // tidak membedakan apa pun; tanpa disaring, PPID/JDIH selalu menang
        // untuk pertanyaan seperti "cara daftar transmigrasi".
        $all = IndonesianText::words($question);
        $words = array_values(array_filter($all, fn (array $keys) => ! IndonesianText::isGeneric($keys)));
        if ($words === []) {
            return null;
        }
        // Pertanyaan menyebut "transmigrasi": portal yang memang khusus urusan
        // transmigrasi (kata itu ada di kata kuncinya) mendapat poin tambahan.
        $aboutTransmigration = count($all) > count($words);

        $best = null;
        $bestScore = 0;
        foreach ($this->publicPortals() as $portal) {
            $name = IndonesianText::frequencies($portal->name.' '.$portal->code);
            $body = IndonesianText::frequencies($portal->purpose.' '.$portal->keywords);

            $score = 0;
            foreach ($words as $keys) {
                if (array_intersect($keys, array_keys($name)) !== []) {
                    $score += 2;
                } elseif (array_intersect($keys, array_keys($body)) !== []) {
                    $score += 1;
                }
            }

            if ($score > 0 && $aboutTransmigration && array_intersect(['transmigrasi', 'transmigran'], array_keys($body)) !== []) {
                $score += 1;
            }
            if ($score > $bestScore) {
                [$best, $bestScore] = [$portal, $score];
            }
        }

        return $bestScore >= 2 ? $best : null;
    }
}
