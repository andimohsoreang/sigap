<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\ShowsLineDiff;
use App\Models\Portal;
use App\Services\AuditService;
use Database\Seeders\PortalSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Perintah sekali jalan: terapkan berkas koreksi katalog portal
 * (database/data/<berkas>.php, isi SEBELUM per kode portal) ke portal yang
 * sudah ada; isi SESUDAH dibaca dari PortalSeeder. Hanya kolom di berkas yang
 * dibandingkan dan diubah, dan hanya bila isinya masih sama persis dengan
 * versi lama (belum disunting Super Admin). Setiap perubahan dicatat di audit
 * log. Tanpa --terapkan hanya menampilkan diff.
 */
class KoreksiPortalCommand extends Command
{
    use ShowsLineDiff;

    protected $signature = 'sigap:koreksi-portal
        {--terapkan : Simpan perubahan (tanpa ini hanya pratinjau)}
        {--berkas=koreksi-portal-2026-10-30 : Berkas koreksi di database/data (tanpa .php)}';

    protected $description = 'Terapkan koreksi katalog portal yang belum disunting Super Admin';

    public function handle(AuditService $audit): int
    {
        $apply = (bool) $this->option('terapkan');
        $file = (string) $this->option('berkas');
        if (preg_match('/^koreksi-portal-[\w-]+$/', $file) !== 1 || ! is_file(database_path("data/{$file}.php"))) {
            $this->error("Berkas koreksi tidak ditemukan: database/data/{$file}.php");

            return self::FAILURE;
        }
        $before = require database_path("data/{$file}.php");
        $after = collect((new PortalSeeder)->portals())->keyBy('code');
        $counts = ['diperbarui' => 0, 'dilewati' => 0];

        DB::transaction(function () use ($apply, $file, $before, $after, $audit, &$counts) {
            foreach ($before as $code => $old) {
                $fields = array_keys($old);
                $seeded = $after->get($code);
                $new = $seeded === null ? [] : array_combine($fields, array_map(fn (string $f) => $seeded[$f] ?? null, $fields));
                $portal = Portal::query()->where('code', $code)->first();
                $current = $portal === null ? [] : array_combine($fields, array_map(fn (string $f) => $portal->getAttribute($f), $fields));
                $this->newLine();
                $this->line('<options=bold>'.($portal->name ?? $code).'</>');

                $skip = match (true) {
                    $seeded === null => 'tidak ada di PortalSeeder',
                    $portal === null => 'portal tidak ada',
                    $current === $new => 'sudah dikoreksi',
                    $current !== $old => 'sudah disunting Super Admin',
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
                    $portal->update($new);
                    $audit->safe(
                        'portal.corrected',
                        $portal,
                        "Portal {$portal->name} dikoreksi: katalog portal tanpa ketentuan aturan (sigap:koreksi-portal --berkas={$file}).",
                        ['kolom' => $changed, 'sebelum' => array_intersect_key($old, array_flip($changed))],
                    );
                }
                $counts['diperbarui']++;
            }
        });

        $this->newLine();
        $verb = $apply ? 'diperbarui' : 'akan diperbarui (pratinjau; jalankan dengan --terapkan)';
        $this->info("{$counts['diperbarui']} portal {$verb}, {$counts['dilewati']} dilewati.");

        return self::SUCCESS;
    }
}
