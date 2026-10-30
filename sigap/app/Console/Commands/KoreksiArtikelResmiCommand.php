<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\ShowsLineDiff;
use App\Models\KnowledgeArticle;
use App\Services\AuditService;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Perintah sekali jalan: terapkan satu berkas koreksi artikel resmi
 * (database/data/<berkas>.php, isi SEBELUM per judul) ke artikel Basis
 * Pengetahuan yang sudah ada; isi SESUDAH dibaca dari OfficialKnowledgeSeeder.
 * Hanya kolom yang ada di berkas yang dibandingkan dan diubah.
 *
 * Artikel hanya diperbarui bila statusnya masih "ditinjau", belum pernah
 * disunting petugas (`updated_by` kosong), dan kolom itu sama persis dengan
 * versi sebelum koreksi. Status tidak diubah — tidak ada yang diterbitkan.
 * Setiap perubahan dicatat di audit log. Tanpa --terapkan hanya menampilkan diff.
 */
class KoreksiArtikelResmiCommand extends Command
{
    use ShowsLineDiff;

    protected $signature = 'sigap:koreksi-artikel-resmi
        {--terapkan : Simpan perubahan (tanpa ini hanya pratinjau)}
        {--berkas=koreksi-artikel-2026-10-30 : Berkas koreksi di database/data (tanpa .php)}';

    protected $description = 'Terapkan koreksi cek fakta ke artikel resmi yang masih ditinjau';

    public function handle(AuditService $audit): int
    {
        $apply = (bool) $this->option('terapkan');
        $file = (string) $this->option('berkas');
        if (preg_match('/^koreksi-artikel-[\w-]+$/', $file) !== 1 || ! is_file(database_path("data/{$file}.php"))) {
            $this->error("Berkas koreksi tidak ditemukan: database/data/{$file}.php");

            return self::FAILURE;
        }
        $before = require database_path("data/{$file}.php");
        $after = collect((new OfficialKnowledgeSeeder)->articles())->keyBy('title');
        $counts = ['diperbarui' => 0, 'dilewati' => 0];

        DB::transaction(function () use ($apply, $file, $before, $after, $audit, &$counts) {
            foreach ($before as $title => $old) {
                $fields = array_keys($old);
                $seeded = $after->get($title);
                $new = $seeded === null ? [] : array_combine($fields, array_map(fn (string $f) => $seeded[$f] ?? null, $fields));
                $this->newLine();
                $this->line("<options=bold>{$title}</>");

                $article = KnowledgeArticle::query()->where('title', $title)->first();
                $current = $article === null ? [] : $this->values($article, $fields);
                $skip = match (true) {
                    $seeded === null => 'tidak ada di OfficialKnowledgeSeeder',
                    $article === null => 'artikel tidak ada',
                    $article->status !== KnowledgeArticle::STATUS_REVIEW => "status \"{$article->status}\", bukan \"ditinjau\"",
                    $current === $new => 'sudah dikoreksi',
                    $article->updated_by !== null || $current !== $old => 'sudah disunting petugas',
                    default => null,
                };
                if ($skip !== null) {
                    $this->warn("  Dilewati: {$skip}.");
                    $counts['dilewati']++;

                    continue;
                }

                $changed = array_keys(array_diff_assoc($new, $old));
                foreach ($changed as $field) {
                    $this->line("  [{$field}]");
                    foreach ($this->diff((string) $old[$field], (string) $new[$field]) as $line) {
                        $this->line('  '.$line);
                    }
                }

                if ($apply) {
                    $article->update($new);
                    $audit->safe(
                        'knowledge.corrected',
                        $article,
                        "Artikel \"{$title}\" dikoreksi sesuai cek fakta (sigap:koreksi-artikel-resmi --berkas={$file}); status tetap ditinjau.",
                        ['kolom' => $changed, 'sebelum' => array_intersect_key($old, array_flip($changed))],
                    );
                }
                $counts['diperbarui']++;
            }
        });

        $this->newLine();
        $verb = $apply ? 'diperbarui' : 'akan diperbarui (pratinjau; jalankan dengan --terapkan)';
        $this->info("{$counts['diperbarui']} artikel {$verb}, {$counts['dilewati']} dilewati. Tidak ada artikel yang diterbitkan.");

        return self::SUCCESS;
    }

    /**
     * Nilai kolom seperti di berkas koreksi (tanggal sebagai "YYYY-MM-DD").
     *
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function values(KnowledgeArticle $article, array $fields): array
    {
        return array_combine($fields, array_map(fn (string $f) => $f === 'tanggal_dasar'
            ? $article->tanggal_dasar?->toDateString()
            : $article->getAttribute($f), $fields));
    }
}
