<?php

namespace App\Services\Channels;

use App\Models\ChannelSyncLog;

/**
 * STUB adapter Whistleblowing System (PRD D7).
 *
 * Demi kerahasiaan pelapor, sinkronisasi WBS hanya menarik data AGREGAT
 * (jumlah & status). Identitas dan isi laporan tetap di sistem WBS internal.
 */
final class WbsStubAdapter implements PengaduanChannelAdapter
{
    public function sync(): ChannelSyncResult
    {
        $aggregate = $this->pullAggregate();
        $pulled = (int) $aggregate['total'];

        ChannelSyncLog::create([
            'channel' => 'wbs',
            'pulled_count' => $pulled,
            'status' => 'berhasil',
            'message' => 'STUB: sinkronisasi agregat WBS (tanpa identitas pelapor).',
        ]);

        return new ChannelSyncResult(
            channel: 'wbs',
            pulledCount: $pulled,
            status: 'berhasil',
            message: 'STUB adapter WBS (agregat).',
            stub: true,
        );
    }

    public function pullAggregate(): array
    {
        return [
            'channel' => 'wbs',
            'total' => 30,
            'by_status' => ['baru' => 5, 'diproses' => 15, 'selesai' => 10],
            'stub' => true,
        ];
    }
}