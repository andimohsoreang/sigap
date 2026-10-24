<?php

use App\Services\Notifications\EmailDriver;
use App\Services\Notifications\InAppDriver;

/*
|--------------------------------------------------------------------------
| Notifikasi (TECH-SPEC §7b — D10)
|--------------------------------------------------------------------------
|
| Daftar driver yang AKTIF. Perbarui preferensi pengguna pada kolom
| users.notify_email / users.notify_in_app (silahkan menambah kolom bila
| diperlukan) — pada fase ini semua kanal aktif kecuali WhatsApp yang
| sengaja tidak diimplementasikan (lihat lampiran A).
|
*/

return [

    // Nama kanal yang dipanggil NotificationService.
    // Nilai yang tidak ada pada array 'drivers' akan diabaikan.
    'channels' => [
        'in_app' => InAppDriver::class,
        'email' => EmailDriver::class,
        // WhatsApp dinonaktifkan — tidak ada driver sampai PRD D10 diaktifkan.
    ],

    // Surel perkembangan tiket ke PELAPOR (tiket dibuat, status berubah,
    // tanggapan publik). Lihat App\Services\ReporterNotifier.
    'reporter_email' => (bool) env('NOTIFY_REPORTER_EMAIL', true),

];
