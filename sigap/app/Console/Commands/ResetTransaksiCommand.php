<?php

namespace App\Console\Commands;

use App\Models\ChatConversation;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use App\Services\AuditService;
use App\Services\ChatAttachmentService;
use App\Services\StatsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Hapus SEMUA data transaksi warga: tiket (+ riwayat, balasan, survei),
 * rujukan, dan percakapan chat beserta berkas lampirannya; juga akun petugas
 * contoh (surel @contoh.test). Data master, akun nyata, Basis Pengetahuan,
 * log aktivitas admin, dan log panggilan AI TIDAK dihapus (jejak audit).
 *
 * Tidak dapat dibatalkan — buat cadangan basis data lebih dulu.
 */
class ResetTransaksiCommand extends Command
{
    protected $signature = 'sigap:reset-transaksi {--force : Tanpa konfirmasi (untuk skrip)}';

    protected $description = 'Hapus semua data transaksi warga (tiket, chat, rujukan, survei) beserta lampiran';

    /** Tabel transaksi, urut aman terhadap foreign key. */
    private const TABLES = ['referral_events', 'referrals', 'surveys', 'ticket_replies', 'ticket_histories', 'chat_messages', 'chat_conversations', 'tickets'];

    public function handle(AttachmentService $ticketFiles, ChatAttachmentService $chatFiles, AuditService $audit): int
    {
        $counts = collect(self::TABLES)->mapWithKeys(fn (string $t) => [$t => DB::table($t)->count()]);
        $this->table(['Tabel', 'Baris'], $counts->map(fn (int $n, string $t) => [$t, $n])->values()->all());

        if (! $this->option('force') && ! $this->confirm('Hapus semua data di atas? Tindakan ini tidak dapat dibatalkan.')) {
            $this->warn('Dibatalkan.');

            return self::FAILURE;
        }

        $ticketPaths = Ticket::withTrashed()->whereNotNull('attachment_path')->pluck('attachment_path');
        $conversationIds = ChatConversation::query()->pluck('id');

        DB::transaction(function () {
            foreach (self::TABLES as $table) {
                DB::table($table)->delete();
            }
            // Akun petugas contoh dari sigap:data-contoh.
            User::query()->where('email', 'like', '%@contoh.test')->delete();
        });

        $ticketPaths->each(fn (string $path) => $ticketFiles->delete($path));
        $conversationIds->each(fn (int $id) => $chatFiles->deleteConversation($id));
        Cache::forget(StatsService::PUBLIC_CACHE_KEY);

        $audit->safe('data.reset_transaksi', null, 'Semua data transaksi warga dihapus lewat perintah sigap:reset-transaksi.', $counts->all());
        $this->info('Selesai: '.$counts->sum().' baris transaksi dihapus.');

        return self::SUCCESS;
    }
}
