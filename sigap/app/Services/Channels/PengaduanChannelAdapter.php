<?php

namespace App\Services\Channels;

/**
 * Kontrak adapter kanal pengaduan nasional (SP4N-LAPOR!, WBS).
 *
 * PRD D7: fase ini memakai driver STUB. Menukar ke integrasi nyata dilakukan
 * cukup dengan membuat implementasi HTTP adapter dan mengganti binding di
 * ChannelsServiceProvider — controller, UI, dan skema tidak berubah.
 */
interface PengaduanChannelAdapter
{
    /** Tarik tiket baru dari kanal. */
    public function sync(): ChannelSyncResult;

    /**
     * Tarik data agregat (khusus WBS: tanpa identitas & isi laporan).
     *
     * @return array<string, mixed>
     */
    public function pullAggregate(): array;
}
