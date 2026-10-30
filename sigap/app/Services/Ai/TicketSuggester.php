<?php

namespace App\Services\Ai;

use App\Enums\TicketImpact;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\Region;
use App\Modules\Ai\AiContext;
use App\Modules\Ai\AiGateway;
use App\Modules\Ai\AiTask;
use App\Modules\Assistant\Assistant;
use App\Services\Knowledge\IndonesianText;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Saran isian tiket dari percakapan (kawasan, kategori, dampak, judul,
 * uraian) agar petugas cukup memeriksa lalu menerbitkan.
 *
 * Model AI dipakai bila aktif; hasilnya divalidasi terhadap daftar kawasan &
 * kategori yang ada. Bila model gagal atau tidak yakin, dipakai pencocokan
 * kata kunci. Saran tidak pernah menerbitkan tiket sendiri.
 */
class TicketSuggester
{
    /** Kata yang menandai dampak, dari paling berat. */
    private const IMPACT_WORDS = [
        'kritis' => ['banjir', 'longsor', 'kebakaran', 'terbakar', 'wabah', 'korban', 'meninggal', 'darurat', 'keselamatan', 'ambruk', 'roboh'],
        'tinggi' => ['rusak berat', 'parah', 'terputus', 'putus', 'tidak bisa', 'tidak dapat', 'sekolah', 'puskesmas', 'akses', 'air bersih', 'berbulan', 'bertahun', 'sengketa'],
        'rendah' => ['saran', 'usul', 'masukan', 'pertanyaan', 'informasi'],
    ];

    /** Kata kunci bantu per jenis kategori (dicocokkan ke nama kategori). */
    private const CATEGORY_HINTS = [
        'infrastruktur' => ['jalan', 'jembatan', 'irigasi', 'drainase', 'listrik', 'air', 'sumur', 'gedung', 'sekolah', 'puskesmas', 'rusak', 'longsor', 'banjir'],
        'lahan' => ['lahan', 'tanah', 'sertifikat', 'sertipikat', 'shm', 'sengketa', 'batas', 'patok', 'diserobot', 'klaim', 'hpl'],
        'bantuan' => ['bantuan', 'jadup', 'jatah', 'catu', 'pangan', 'sembako', 'beras', 'bibit', 'pupuk', 'ternak', 'bansos'],
        'data' => ['data', 'aplikasi', 'website', 'situs', 'sistem', 'login', 'akun', 'internet', 'sinyal'],
    ];

    public function __construct(
        private readonly AiGateway $gateway,
        private readonly PiiMasker $masker,
    ) {}

    /**
     * @return array{judul: string, uraian: string, region_id: int|null, category_id: int|null, impact: string, alasan: string|null, sumber: string}
     */
    public function suggest(ChatConversation $conversation, ?int $fixedRegionId = null): array
    {
        $summary = trim((string) $conversation->ai_summary);
        $messages = $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['user', 'guest'])
            ->reorder('id')
            ->limit(10)
            ->pluck('body');
        $text = trim($summary.' '.$messages->implode(' '));

        $regions = Region::query()->orderBy('name')->get(['id', 'name']);
        $categories = Category::query()->orderBy('name')->get(['id', 'name']);

        $base = [
            'judul' => Str::limit($summary !== '' ? Str::before($summary, '.') : Str::limit((string) $messages->first(), 100, ''), 120, ''),
            'uraian' => trim(($summary !== '' ? "Ringkasan asisten: {$summary}\n\n" : '')."Pesan warga di live chat:\n- ".$messages->implode("\n- ")),
        ];

        $ai = Assistant::enabled() ? $this->fromModel($text, $regions, $categories, $conversation->id) : null;
        $heuristic = $this->fromKeywords($text, $regions, $categories);

        $regionId = $fixedRegionId ?? $ai['region_id'] ?? $heuristic['region_id'];

        return [
            'judul' => ($ai['judul'] ?? '') !== '' ? $ai['judul'] : ($base['judul'] ?: 'Aduan dari live chat'),
            'uraian' => $base['uraian'],
            'region_id' => $regionId,
            'category_id' => $ai['category_id'] ?? $heuristic['category_id'],
            'impact' => $ai['impact'] ?? $heuristic['impact'],
            'alasan' => $ai['alasan'] ?? null,
            'sumber' => $ai !== null ? 'ai' : 'kata_kunci',
        ];
    }

    /**
     * @param  Collection<int, Region>  $regions
     * @param  Collection<int, Category>  $categories
     * @return array{judul: string, region_id: int|null, category_id: int|null, impact: string, alasan: string|null}|null
     */
    private function fromModel(string $text, Collection $regions, Collection $categories, int $conversationId): ?array
    {
        // Penyamaran 'aduan' dilakukan AiGateway; nama kawasan/kategori adalah data master.
        $result = $this->gateway->run(AiTask::SaranTiket, [
            'aduan' => Str::limit($text, 3000),
            'kawasan' => $regions->map(fn (Region $r) => ['id' => $r->id, 'nama' => $r->name])->values()->all(),
            'kategori' => $categories->map(fn (Category $c) => ['id' => $c->id, 'nama' => $c->name])->values()->all(),
        ], AiContext::conversation($conversationId));
        if (! $result->isOk()) {
            return null;
        }
        $data = $result->data;

        $impact = TicketImpact::tryFrom((string) ($data['dampak'] ?? ''));
        $regionId = (int) ($data['kawasan_id'] ?? 0);
        $categoryId = (int) ($data['kategori_id'] ?? 0);

        return [
            'judul' => Str::limit(trim((string) ($data['judul'] ?? '')), 120, ''),
            'region_id' => $regions->contains('id', $regionId) ? $regionId : null,
            'category_id' => $categories->contains('id', $categoryId) ? $categoryId : null,
            'impact' => $impact?->value ?? 'sedang',
            'alasan' => Str::limit(trim((string) ($data['alasan'] ?? '')), 200) ?: null,
        ];
    }

    /**
     * @param  Collection<int, Region>  $regions
     * @param  Collection<int, Category>  $categories
     * @return array{region_id: int|null, category_id: int|null, impact: string}
     */
    public function fromKeywords(string $text, Collection $regions, Collection $categories): array
    {
        $lower = mb_strtolower($text);
        $keys = collect(IndonesianText::words($text))->flatten()->unique()->all();

        // Kawasan: nama tempat ("Bulungan") wajib cocok; nomor SP menambah keyakinan.
        $region = $regions->map(function (Region $r) use ($lower) {
            $score = 0;
            foreach (preg_split('/\s+/', mb_strtolower($r->name)) ?: [] as $part) {
                $isSp = (bool) preg_match('/^sp\s?\d+$/', $part);
                if (mb_strlen($part) >= 3 && preg_match('/(?<!\pL)'.preg_quote($part, '/').'(?!\pL|\d)/u', $lower)) {
                    $score += $isSp ? 1 : 3;
                }
            }

            return [$r->id, $score];
        })->filter(fn (array $p) => $p[1] >= 3)->sortByDesc(fn (array $p) => $p[1])->first();

        $category = $categories->map(function (Category $c) use ($keys) {
            $hints = IndonesianText::words($c->name);
            foreach (self::CATEGORY_HINTS as $group => $words) {
                if (str_contains(mb_strtolower($c->name), $group)) {
                    $hints = [...$hints, ...array_map(fn (string $w) => IndonesianText::keys($w), $words)];
                }
            }
            $score = collect($hints)->filter(fn (array $k) => array_intersect($k, $keys) !== [])->count();

            return [$c->id, $score];
        })->filter(fn (array $p) => $p[1] > 0)->sortByDesc(fn (array $p) => $p[1])->first();

        $impact = 'sedang';
        foreach (self::IMPACT_WORDS as $level => $words) {
            if (collect($words)->contains(fn (string $w) => str_contains($lower, $w))) {
                $impact = $level;
                break;
            }
        }

        return ['region_id' => $region[0] ?? null, 'category_id' => $category[0] ?? null, 'impact' => $impact];
    }
}
