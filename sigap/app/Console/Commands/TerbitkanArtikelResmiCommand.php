<?php

namespace App\Console\Commands;

use App\Models\KnowledgeArticle;
use App\Services\AuditService;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Perintah sekali jalan: terbitkan artikel resmi (OfficialKnowledgeSeeder)
 * per batch atas keputusan Super Admin, setelah cek fakta berbukti kutipan
 * dan koreksi (lihat README, "Prosedur artikel resmi").
 *
 * Hanya artikel berstatus "ditinjau" yang isinya sama persis dengan versi
 * seeder terkini yang diterbitkan — artikel yang disunting petugas atau belum
 * dikoreksi dilewati. Setiap penerbitan dicatat di audit log
 * (`knowledge.published`) beserta dasar keputusannya. Tanpa --terapkan hanya
 * pratinjau.
 */
class TerbitkanArtikelResmiCommand extends Command
{
    protected $signature = 'sigap:terbitkan-artikel-resmi
        {--terapkan : Terbitkan (tanpa ini hanya pratinjau)}
        {--dasar= : Dasar keputusan penerbitan untuk audit log (wajib bersama --terapkan)}';

    protected $description = 'Terbitkan artikel resmi yang masih ditinjau dan sama dengan seeder terkini';

    /** Kolom isi yang dibandingkan dengan seeder (kolom dasar hukum bila seeder mengisinya). */
    private const CONTENT = ['body', 'category', 'keywords', 'source', 'source_ref', 'source_url'];

    public function handle(AuditService $audit): int
    {
        $apply = (bool) $this->option('terapkan');
        $reason = trim((string) $this->option('dasar'));
        if ($apply && $reason === '') {
            $this->error('Isi --dasar="…" (dasar keputusan penerbitan) untuk audit log.');

            return self::FAILURE;
        }

        $published = [];
        $skipped = [];

        DB::transaction(function () use ($apply, $reason, $audit, &$published, &$skipped) {
            foreach ((new OfficialKnowledgeSeeder)->articles() as $seeded) {
                $title = $seeded['title'];
                $fields = [...self::CONTENT, ...array_intersect(KnowledgeArticle::LEGAL_BASIS_FIELDS, array_keys($seeded))];
                $article = KnowledgeArticle::query()->where('title', $title)->first();

                $skip = match (true) {
                    $article === null => 'artikel tidak ada',
                    $article->status === KnowledgeArticle::STATUS_PUBLISHED => 'sudah terbit',
                    $article->status !== KnowledgeArticle::STATUS_REVIEW => "status \"{$article->status}\", bukan \"ditinjau\"",
                    ($diff = $this->differences($article, $seeded, $fields)) !== [] => 'isi berbeda dari seeder terkini ('.implode(', ', $diff).')',
                    default => null,
                };
                if ($skip !== null) {
                    $skipped[] = "{$title} — {$skip}";

                    continue;
                }

                if ($apply) {
                    $article->update(['status' => KnowledgeArticle::STATUS_PUBLISHED]);
                    $audit->safe('knowledge.published', $article, "Artikel \"{$title}\" diterbitkan (sigap:terbitkan-artikel-resmi). Dasar: {$reason}");
                }
                $published[] = $title;
            }
        });

        $this->line('<options=bold>'.($apply ? 'Terbit' : 'Akan terbit (pratinjau)').' ('.count($published).'):</>');
        foreach ($published as $title) {
            $this->line("  + {$title}");
        }
        $this->line('<options=bold>Dilewati ('.count($skipped).'):</>');
        foreach ($skipped as $line) {
            $this->line("  - {$line}");
        }
        $this->newLine();
        $this->info($apply
            ? count($published).' artikel diterbitkan, '.count($skipped).' dilewati.'
            : count($published).' artikel akan diterbitkan (pratinjau; jalankan dengan --terapkan --dasar="…"), '.count($skipped).' dilewati.');

        return self::SUCCESS;
    }

    /**
     * Kolom yang isinya berbeda dari seeder.
     *
     * @param  array<string, mixed>  $seeded
     * @param  list<string>  $fields
     * @return list<string>
     */
    private function differences(KnowledgeArticle $article, array $seeded, array $fields): array
    {
        return array_values(array_filter($fields, function (string $field) use ($article, $seeded) {
            $current = $field === 'tanggal_dasar' ? $article->tanggal_dasar?->toDateString() : $article->getAttribute($field);

            return $current !== ($seeded[$field] ?? null);
        }));
    }
}
