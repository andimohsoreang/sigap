<?php

use App\Models\KnowledgeArticle;
use App\Models\Portal;
use Database\Seeders\PortalSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Sinkronkan kanal & katalog portal dengan situs resmi Kementerian
 * Transmigrasi (diperiksa 25 Oktober 2026):
 * - akun media sosial resmi @kementrans.ri (bukan @SIGAP_RI),
 * - alamat SP4N-LAPOR! instansi yang benar,
 * - "Whistleblowing System": Kementrans tidak punya situs WBS sendiri;
 *   diarahkan ke tata cara pengaduan penyalahgunaan wewenang (PPID/Itjen),
 * - portal resmi yang belum ada ditambahkan; SIBARDUKTRANS kini didampingi
 *   sampai nomor pendaftaran didapat (hanya bila belum diubah admin),
 * - artikel "SP4N-LAPOR! atau WBS" diperbarui bila masih teks bawaan.
 * Basis pengetahuan/katalog yang masih kosong dibiarkan untuk diisi seeder.
 */
return new class extends Migration
{
    private const OLD_SIBARDUKTRANS_LAST_STEP = 'Pendaftaran juga dapat dilakukan di kantor desa/kelurahan atau perangkat daerah kabupaten/kota yang menangani transmigrasi sesuai KTP Anda.';

    public function up(): void
    {
        DB::table('channels')->where('name', '@SIGAP_RI')->update([
            'name' => '@kementrans.ri', 'account_name' => '@kementrans.ri', 'url' => 'https://www.instagram.com/kementrans.ri/', 'updated_at' => now(),
        ]);
        DB::table('channels')->where('name', 'SP4N-LAPOR!')->where('url', 'like', '%api.lapor.go.id%')->update([
            'url' => 'https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi', 'updated_at' => now(),
        ]);
        DB::table('channels')->where('name', 'Whistleblowing System')->where('url', 'like', '%kemenatrans.go.id%')->update([
            'account_name' => 'Inspektorat Jenderal',
            'url' => 'https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang',
            'updated_at' => now(),
        ]);

        if (DB::table('portals')->exists()) {
            $official = collect((new PortalSeeder)->portals())->keyBy('code');
            $next = (int) DB::table('portals')->max('sort');

            foreach ($official as $code => $data) {
                if (! DB::table('portals')->where('code', $code)->exists()) {
                    Portal::query()->create($data + ['sort' => ++$next]);
                }
            }

            $sib = DB::table('portals')->where('code', 'sibarduktrans')->first();
            if ($sib && ! $sib->track_completion && str_ends_with(trim((string) $sib->steps), self::OLD_SIBARDUKTRANS_LAST_STEP)) {
                DB::table('portals')->where('code', 'sibarduktrans')->update([
                    'track_completion' => true,
                    'steps' => $official['sibarduktrans']['steps'],
                    'updated_at' => now(),
                ]);
            }

            DB::table('portals')->where('code', 'ppid')->where('contact', 'ppid@transmigrasi.go.id · 021-7994372 · Senin–Jumat 08.00–15.00 WIB')
                ->update(['contact' => $official['ppid']['contact'], 'updated_at' => now()]);
            Cache::forget(Portal::CACHE_KEY);
        }

        DB::table('knowledge_articles')
            ->where('title', 'Kapan sebaiknya melapor ke SP4N-LAPOR! atau WBS?')
            ->where('body', 'like', '%Gunakan Whistleblowing System (WBS)%')
            ->update([
                'title' => 'Kapan sebaiknya melapor ke SP4N-LAPOR! atau ke Inspektorat Jenderal?',
                'body' => 'Gunakan SP4N-LAPOR! (sp4n.lapor.go.id) bila masalah Anda juga menyangkut instansi lain, misalnya pemerintah daerah atau ATR/BPN; Anda dapat memilih agar identitas dirahasiakan. Untuk dugaan pungutan liar, penyalahgunaan wewenang, atau pelanggaran oleh pegawai Kementerian Transmigrasi, laporkan ke PPID (ppid@transmigrasi.go.id, WhatsApp 0812-9001-9358) yang meneruskannya ke Inspektorat Jenderal paling lambat 30 hari kerja. Gratifikasi dilaporkan ke Gratifikasi Online KPK (gol.kpk.go.id).',
                'updated_at' => now(),
            ]);
        Cache::forget(KnowledgeArticle::CACHE_KEY);
    }

    public function down(): void
    {
        // Data rujukan resmi; tidak dikembalikan ke alamat lama yang keliru.
    }
};
