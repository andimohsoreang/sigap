<?php

namespace App\Console\Commands;

use App\Models\Ticket;
use App\Models\Unit;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Perintah sekali jalan (PRD-UNIT-KERJA §9): isi `users.unit_id` dan
 * `tickets.reporter_unit_id` dari teks unit lama, HANYA bila teksnya sama
 * persis (tanpa beda huruf besar/kecil & spasi tepi) dengan nama atau
 * singkatan unit aktif di master. Nama yang tidak cocok dilaporkan dan tidak
 * ditebak; Super Admin memilih unitnya sendiri di Daftar Admin. Baris yang
 * sudah punya unit tidak disentuh. Tanpa --terapkan hanya menampilkan pratinjau.
 */
class PetakanUnitCommand extends Command
{
    protected $signature = 'sigap:petakan-unit {--terapkan : Simpan perubahan (tanpa ini hanya pratinjau)}';

    protected $description = 'Petakan teks unit lama petugas & pelapor internal ke master Unit Kerja';

    public function handle(AuditService $audit): int
    {
        $apply = (bool) $this->option('terapkan');
        $lookup = [];
        foreach (Unit::query()->active()->get(['id', 'name', 'short_name']) as $unit) {
            foreach (array_filter([$unit->name, $unit->short_name]) as $label) {
                // Label yang dipakai dua unit berbeda tidak dipetakan (ambigu).
                $key = self::key($label);
                $lookup[$key] = isset($lookup[$key]) && $lookup[$key] !== $unit->id ? false : $unit->id;
            }
        }

        $staff = User::query()->whereNull('unit_id')->whereNotNull('unit')->where('unit', '!=', '')->get(['id', 'name', 'username', 'unit']);
        $tickets = Ticket::query()->whereNull('reporter_unit_id')->whereNotNull('reporter_unit')->where('reporter_unit', '!=', '')
            ->toBase()->select('reporter_unit', DB::raw('COUNT(*) as total'))->groupBy('reporter_unit')->get();

        $staffRows = $staff->map(fn (User $u) => [$u->name, $u->unit, self::label($lookup[self::key($u->unit)] ?? null)]);
        $ticketRows = $tickets->map(fn (object $t) => [$t->reporter_unit, (int) $t->total, self::label($lookup[self::key($t->reporter_unit)] ?? null)]);

        $this->info('Petugas tanpa unit master: '.$staff->count());
        $this->table(['Petugas', 'Teks unit lama', 'Dipetakan ke'], $staffRows->all());
        $this->info('Teks unit pelapor internal: '.$tickets->count());
        $this->table(['Teks unit lama', 'Tiket', 'Dipetakan ke'], $ticketRows->all());

        if (! $apply) {
            $this->warn('Pratinjau saja. Jalankan dengan --terapkan untuk menyimpan.');

            return self::SUCCESS;
        }

        $counts = ['petugas' => 0, 'tiket' => 0];
        DB::transaction(function () use ($staff, $tickets, $lookup, $audit, &$counts) {
            foreach ($staff as $user) {
                $unitId = $lookup[self::key($user->unit)] ?? null;
                if (is_int($unitId)) {
                    $user->forceFill(['unit_id' => $unitId])->save();
                    $audit->safe('admin.unit_updated', $user, "Unit kerja {$user->name} ({$user->username}) dipetakan dari teks \"{$user->unit}\".");
                    $counts['petugas']++;
                }
            }
            foreach ($tickets as $row) {
                $unitId = $lookup[self::key($row->reporter_unit)] ?? null;
                if (is_int($unitId)) {
                    $counts['tiket'] += Ticket::query()->whereNull('reporter_unit_id')->where('reporter_unit', $row->reporter_unit)
                        ->update(['reporter_unit_id' => $unitId]);
                }
            }
        });

        $this->info("Dipetakan: {$counts['petugas']} petugas, {$counts['tiket']} tiket. Sisanya tetap teks; pilih unitnya di Daftar Admin.");

        return self::SUCCESS;
    }

    private static function key(string $label): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $label) ?? $label));
    }

    private static function label(int|false|null $unitId): string
    {
        return match (true) {
            $unitId === false => '— (ambigu, tidak dipetakan)',
            $unitId === null => '— (tidak ada di master)',
            default => (string) Unit::query()->whereKey($unitId)->value('name'),
        };
    }
}
