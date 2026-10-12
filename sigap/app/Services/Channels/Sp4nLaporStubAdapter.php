<?php

namespace App\Services\Channels;

use App\Models\ChannelSyncLog;

/**
 * STUB adapter SP4N-LAPOR! (PRD D7).
 *
 * Mengembalikan data contoh terstruktur agar alur integrasi & log sinkronisasi
 * dapat diuji end-to-end tanpa memanggil API eksternal. Tidak menyentuh
 * jaringan. Ganti dengan Sp4nLaporHttpAdapter saat integrasi nyata siap.
 */
final class Sp4nLaporStubAdapter implements PengaduanChannelAdapter
{
    public function sync(): ChannelSyncResult
    {
        // Data contoh: pada implementasi nyata, ini hasil panggilan HTTP.
        $pulled = 950; // paritas angka dummy pada UI lama

        ChannelSyncLog::create([
            'channel' => 'sp4n',
            'pulled_count' => $pulled,
            'status' => 'berhasil',
            'message' => 'STUB: sinkronisasi SP4N-LAPOR! (belum memanggil API nyata).',
        ]);

        return new ChannelSyncResult(
            channel: 'sp4n',
            pulledCount: $pulled,
            status: 'berhasil',
            message: 'STUB adapter SP4N-LAPOR!.',
            stub: true,
        );
    }

    public function pullAggregate(): array
    {
        return [
            'channel' => 'sp4n',
            'total' => 950,
            'by_status' => ['baru' => 120, 'diproses' => 430, 'selesai' => 400],
            'stub' => true,
        ];
    }
}
