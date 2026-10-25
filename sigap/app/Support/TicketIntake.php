<?php

namespace App\Support;

/**
 * Pintu masuk & kanal sebuah tiket, diturunkan dari kolom yang SUDAH ada
 * (tanpa kolom baru):
 *
 * - Chat TARA → petugas : `source = live_chat` (Input Manual dengan sumber
 *   live chat) ATAU tiket ditautkan ke percakapan (`chat_conversations.ticket_id`,
 *   diisi saat petugas menerbitkan tiket dari Pesan Masuk).
 * - Input manual petugas: `source` terisi (tatap_muka, call_center, surat,
 *   instagram, x, facebook, tiktok) — hanya Input Manual yang mengisi kolom ini.
 * - Formulir web        : `source` kosong (formulir publik `/pengaduan/baru`,
 *   formulir internal pegawai, dan API pengaduan).
 *
 * Ekspresi SQL hanya memakai konstanta dari kode (aman dari injeksi) dan
 * kompatibel SQLite & PostgreSQL.
 */
final class TicketIntake
{
    public const PINTU_WEB = 'web';

    public const PINTU_MANUAL = 'manual';

    public const PINTU_CHAT = 'chat';

    /** Label pintu masuk (urutan tampil). */
    public const PINTU = [
        self::PINTU_WEB => 'Formulir web',
        self::PINTU_MANUAL => 'Input manual petugas',
        self::PINTU_CHAT => 'Chat TARA → petugas',
    ];

    /** Label kanal (urutan tampil). */
    public const KANAL = [
        'web' => 'Formulir web',
        'chat' => 'Chat TARA → petugas',
        'medsos' => 'Media sosial (IG, X, FB, TikTok)',
        'call_center' => 'Call center',
        'tatap_muka' => 'Tatap muka',
        'surat' => 'Surat',
        'internal' => 'Formulir internal pegawai',
        'kanal' => 'Kanal terhubung',
        'lainnya' => 'Lainnya',
    ];

    /** Kanal yang selalu ditampilkan walau jumlahnya 0. */
    public const KANAL_UTAMA = ['web', 'chat', 'medsos', 'call_center', 'tatap_muka', 'surat'];

    /** Kanal → pintu masuk. */
    public const KANAL_PINTU = [
        'web' => self::PINTU_WEB,
        'internal' => self::PINTU_WEB,
        'kanal' => self::PINTU_WEB,
        'chat' => self::PINTU_CHAT,
        'medsos' => self::PINTU_MANUAL,
        'call_center' => self::PINTU_MANUAL,
        'tatap_muka' => self::PINTU_MANUAL,
        'surat' => self::PINTU_MANUAL,
        'lainnya' => self::PINTU_MANUAL,
    ];

    private const MEDSOS = ['instagram', 'x', 'facebook', 'tiktok'];

    /** Ekspresi CASE yang menghasilkan kunci kanal per baris tiket. */
    public static function kanalSql(): string
    {
        $medsos = "'".implode("', '", self::MEDSOS)."'";

        return 'CASE'
            ." WHEN tickets.source = 'live_chat' OR EXISTS (SELECT 1 FROM chat_conversations cc WHERE cc.ticket_id = tickets.id) THEN 'chat'"
            ." WHEN tickets.source IN ({$medsos}) THEN 'medsos'"
            ." WHEN tickets.source IN ('call_center', 'tatap_muka', 'surat') THEN tickets.source"
            ." WHEN tickets.source IS NOT NULL THEN 'lainnya'"
            ." WHEN tickets.is_internal = TRUE THEN 'internal'"
            ." WHEN tickets.channel_id IS NOT NULL THEN 'kanal'"
            ." ELSE 'web' END";
    }

    /** Saring query tiket ke satu kanal (kunci tak dikenal diabaikan). */
    public static function applyKanal($query, string $kanal)
    {
        if (! array_key_exists($kanal, self::KANAL)) {
            return $query;
        }

        return $query->whereRaw('('.self::kanalSql().') = ?', [$kanal]);
    }
}
