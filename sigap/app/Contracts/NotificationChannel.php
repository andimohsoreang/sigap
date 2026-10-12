<?php

namespace App\Contracts;

/**
 * Kanal notifikasi (TECH-SPEC §7b — D10).
 *
 * Fase ini hanya mengimplementasikan driver IN-APP dan EMAIL.
 * WhatsApp SENGAJA tidak ada driver-nya; field preferensi tetap disimpan
 * agar tidak mengubah UI, tetapi tidak pernah memicu pengiriman.
 */
interface NotificationChannel
{
    /**
     * Kirim notifikasi. Driver wajib tahan banting: kegagalan satu kanal
     * tidak boleh menggagalkan proses bisnis (dicegat di NotificationService).
     */
    public function send(\App\Models\User $recipient, array $payload): void;

    /** Nama kanal, sesuai kunci pada `config('notifications.channels')`. */
    public function name(): string;
}