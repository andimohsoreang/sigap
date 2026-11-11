<?php

/**
 * Melengkapi data contoh untuk tangkapan layar Panduan (dijalankan oleh
 * playwright.panduan.config.ts lewat tinker, hanya di database panduan.sqlite).
 * Nama orang di sini fiktif.
 */

use App\Models\Ticket;
use App\Models\Unit;
use App\Models\User;
use App\Services\DispositionService;
use Database\Seeders\UnitSeeder;

$creds = json_decode(file_get_contents(storage_path('app/e2e/credentials.json')), true);

// Tiket factory dari sigap:e2e-setup berisi teks acak; tidak dipakai di panduan.
Ticket::query()->whereIn('ticket_no', $creds['tiket_awal'])->forceDelete();

(new UnitSeeder)->run();
$unit = fn (string $code) => Unit::query()->where('code', $code)->firstOrFail();

$admin = User::query()->where('username', $creds['username'])->firstOrFail();
$admin->update(['name' => 'Nadia Kusuma', 'username' => 'nadia.kusuma', 'email' => 'nadia.kusuma@contoh.test', 'unit_id' => $unit('SETJEN-UMUM')->id]);
file_put_contents(storage_path('app/e2e/credentials.json'), json_encode(['username' => 'nadia.kusuma'] + $creds, JSON_PRETTY_PRINT));

User::query()->where('username', 'contoh.rina')->update(['unit_id' => $unit('PPKT-BANGKAWASAN')->id]);
User::query()->where('username', 'contoh.dimas')->update(['unit_id' => $unit('PEPMT-PEMBERDAYAAN')->id]);

$warga = User::findByNik($creds['warga_nik']);
$warga->update(['name' => 'Siti Rahmawati', 'email' => 'siti.rahmawati@contoh.test', 'phone' => '081234567890']);

$publik = Ticket::query()->where('is_internal', false)->orderBy('id');
foreach ((clone $publik)->whereIn('status', ['selesai', 'diproses', 'baru'])->take(3)->get() as $ticket) {
    $ticket->update(['reporter_id' => $warga->id, 'reporter_name' => $warga->name]);
}

// Satu tiket selesai tanpa akun yang belum disurvei: tamu dapat mengisinya dari halaman Lacak.
$selesai = (clone $publik)->whereNull('reporter_id')->where('status', 'selesai')->where('title', 'like', 'Rumah transmigran%')->firstOrFail();
$selesai->survey()->delete();
$selesai->forceFill(['review_requested_at' => null, 'review_reason' => null])->save();
$path = storage_path('app/e2e/credentials.json');
file_put_contents($path, json_encode(['survei_tiket' => $selesai->ticket_no] + json_decode(file_get_contents($path), true), JSON_PRETTY_PRINT));

$dispositions = app(DispositionService::class);
// Disposisi ke unit petugas yang menangani, agar detail tiket konsisten. Tiket
// "Jembatan kayu" dipakai tangkapan layar detail tiket (tests/panduan/tangkapan.spec.ts).
foreach (['Jembatan kayu%', 'Sengketa batas%'] as $judul) {
    $ticket = (clone $publik)->where('title', 'like', $judul)->firstOrFail();
    $dispositions->dispose($ticket, $ticket->assignee->workUnit, $admin, 'Mohon ditindaklanjuti sesuai kewenangan unit.');
}

if (Ticket::query()->whereNotNull('unit_id')->count() < 2) {
    // Galat di tinker tidak menghentikan rantai webServer; berhenti keras di sini.
    fwrite(STDERR, 'Data panduan tidak lengkap: disposisi contoh gagal.'.PHP_EOL);
    exit(1);
}

echo 'Data panduan siap.'.PHP_EOL;
