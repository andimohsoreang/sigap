<?php

namespace App\Console\Commands;

use App\Models\KnowledgeArticle;
use App\Services\AuditService;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Perintah sekali jalan: terapkan koreksi cek fakta 30 Oktober 2026 ke artikel
 * Basis Pengetahuan yang sudah ada (database/data/koreksi-artikel-2026-10-30.php).
 *
 * Artikel hanya diperbarui bila statusnya masih "ditinjau", belum pernah
 * disunting petugas (`updated_by` kosong), dan isinya sama persis dengan versi
 * sebelum koreksi. Status tidak diubah — tidak ada yang diterbitkan. Setiap
 * perubahan dicatat di audit log. Tanpa --terapkan hanya menampilkan diff.
 */
class KoreksiArtikelResmiCommand extends Command
{
    protected $signature = 'sigap:koreksi-artikel-resmi {--terapkan : Simpan perubahan (tanpa ini hanya pratinjau)}';

    protected $description = 'Terapkan koreksi cek fakta 30-10-2026 ke artikel resmi yang masih ditinjau';

    private const FIELDS = ['body', 'source', 'source_ref', 'source_url'];

    public function handle(AuditService $audit): int
    {
        $apply = (bool) $this->option('terapkan');
        $before = require database_path('data/koreksi-artikel-2026-10-30.php');
        $after = collect((new OfficialKnowledgeSeeder)->articles())->keyBy('title');
        $counts = ['diperbarui' => 0, 'dilewati' => 0];

        DB::transaction(function () use ($apply, $before, $after, $audit, &$counts) {
            foreach ($before as $title => $old) {
                $new = collect($after->get($title))->only(self::FIELDS)->all();
                $this->newLine();
                $this->line("<options=bold>{$title}</>");

                $article = KnowledgeArticle::query()->where('title', $title)->first();
                $skip = match (true) {
                    count($new) !== count(self::FIELDS) => 'tidak ada di OfficialKnowledgeSeeder',
                    $article === null => 'artikel tidak ada',
                    $article->status !== KnowledgeArticle::STATUS_REVIEW => "status \"{$article->status}\", bukan \"ditinjau\"",
                    $article->only(self::FIELDS) === $new => 'sudah dikoreksi',
                    $article->updated_by !== null || $article->only(self::FIELDS) !== $old => 'sudah disunting petugas',
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
                        "Artikel \"{$title}\" dikoreksi sesuai cek fakta 30-10-2026 (sigap:koreksi-artikel-resmi); status tetap ditinjau.",
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
     * Diff baris sederhana (LCS): baris tetap diawali "  ", dihapus "- ", ditambah "+ ".
     *
     * @return list<string>
     */
    private function diff(string $old, string $new): array
    {
        $a = explode("\n", $old);
        $b = explode("\n", $new);
        $lcs = array_fill(0, count($a) + 1, array_fill(0, count($b) + 1, 0));
        for ($i = count($a) - 1; $i >= 0; $i--) {
            for ($j = count($b) - 1; $j >= 0; $j--) {
                $lcs[$i][$j] = $a[$i] === $b[$j] ? $lcs[$i + 1][$j + 1] + 1 : max($lcs[$i + 1][$j], $lcs[$i][$j + 1]);
            }
        }

        $lines = [];
        [$i, $j] = [0, 0];
        while ($i < count($a) || $j < count($b)) {
            if ($i < count($a) && $j < count($b) && $a[$i] === $b[$j]) {
                $lines[] = '  '.$a[$i++];
                $j++;
            } elseif ($j < count($b) && ($i === count($a) || $lcs[$i][$j + 1] >= $lcs[$i + 1][$j])) {
                $lines[] = '+ '.$b[$j++];
            } else {
                $lines[] = '- '.$a[$i++];
            }
        }

        return $lines;
    }
}
