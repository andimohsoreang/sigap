<?php

namespace App\Modules\Ai;

use App\Models\AiCall;
use App\Models\AiQualityRun;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Throwable;

/**
 * Angka halaman Kesehatan AI (PRD-AI FR-AI-08): status penyedia, panggilan
 * hari ini per tugas, galat, P50/P95, token vs anggaran, cadangan, dan hasil
 * uji kualitas terakhir. Hanya dari `ai_calls`, `ai_quality_runs`, dan cache
 * sirkuit/anggaran — tanpa isi percakapan.
 */
final class AiHealth
{
    private const TZ = 'Asia/Jakarta';

    /** Hari ke belakang pada grafik tren (termasuk hari ini). */
    public const TREND_DAYS = 14;

    /** Status yang benar-benar memanggil penyedia (punya waktu respons). */
    private const PROVIDER_STATUSES = [AiCall::STATUS_OK, AiCall::STATUS_ERROR, AiCall::STATUS_TIMEOUT, AiResult::FALLBACK, AiCall::STATUS_REJECTED];

    public function __construct(
        private readonly CircuitBreaker $breaker,
        private readonly TokenBudget $budget,
    ) {}

    /** @return array<string, mixed> */
    public function snapshot(): array
    {
        $today = CarbonImmutable::now(self::TZ)->startOfDay();
        $calls = AiCall::query()
            ->where('created_at', '>=', $today->subDays(self::TREND_DAYS - 1)->setTimezone(config('app.timezone')))
            ->orderBy('id')
            ->get(['task', 'status', 'latency_ms', 'prompt_tokens', 'completion_tokens', 'conversation_id', 'created_at']);
        $todayCalls = $calls->filter(fn (AiCall $c) => $c->created_at->greaterThanOrEqualTo($today));

        $summary = $this->summarize($todayCalls);

        return [
            'status' => $this->status($summary),
            'hari_ini' => $summary,
            'per_tugas' => collect(AiTask::cases())
                ->map(fn (AiTask $task) => ['tugas' => $task->value] + $this->summarize($todayCalls->where('task', $task->value)))
                ->values()
                ->all(),
            'anggaran' => $this->budgetInfo(),
            'antrean' => $this->queueInfo(),
            'tren' => $this->trend($calls, $today),
            'galat_terakhir' => AiCall::query()
                ->whereIn('status', [AiCall::STATUS_ERROR, AiCall::STATUS_TIMEOUT, AiResult::FALLBACK, AiCall::STATUS_REJECTED])
                ->latest('id')
                ->limit(10)
                ->get(['id', 'task', 'status', 'error_code', 'latency_ms', 'created_at'])
                ->map(fn (AiCall $c) => [
                    'id' => $c->id,
                    'tugas' => $c->task,
                    'status' => $c->status,
                    'kode' => $c->error_code,
                    'latency_ms' => $c->latency_ms,
                    'waktu' => $c->created_at?->toIso8601String(),
                ])
                ->all(),
            'uji' => AiQualityRun::query()->latest('id')->limit(8)->get()->map(fn (AiQualityRun $r) => [
                'id' => $r->id,
                'waktu' => $r->created_at?->toIso8601String(),
                'model' => $r->model,
                'dengan_model' => $r->with_model,
                'lulus' => $r->passed,
                'pencarian' => [$r->retrieval_hits, $r->retrieval_total],
                'klasifikasi' => [$r->classification_hits, $r->classification_total],
                'tanpa_sumber' => $r->unsourced,
                'gagal' => $r->failed_calls,
                'angka_ditolak' => $r->number_rejections,
                'median_ms' => $r->median_ms,
                'p95_ms' => $r->p95_ms,
                'alasan' => $r->failures,
            ])->all(),
            'konfigurasi' => [
                'aktif' => (bool) config('services.ai.enabled'),
                'driver' => (string) config('services.ai.driver'),
                'model' => (string) config('services.ai.model'),
                'penyedia' => parse_url((string) config('services.ai.base_url'), PHP_URL_HOST) ?: null,
                'asinkron' => (bool) config('services.ai.async'),
                'ambang_sirkuit' => max(1, (int) config('services.ai.breaker_threshold', 5)),
                'jeda_sirkuit' => max(1, (int) config('services.ai.breaker_cooldown', 300)),
                'batas_per_percakapan' => (int) config('services.ai.max_calls_per_conversation_hour', 20),
            ],
        ];
    }

    /**
     * @param  Collection<int, AiCall>  $calls
     * @return array<string, int|float|null>
     */
    private function summarize(Collection $calls): array
    {
        $provider = $calls->whereIn('status', self::PROVIDER_STATUSES);
        $failed = $calls->whereIn('status', [AiCall::STATUS_ERROR, AiCall::STATUS_TIMEOUT])->count();
        $latencies = $provider->pluck('latency_ms')->map(fn ($v) => (int) $v)->sort()->values()->all();
        $tokens = (int) $calls->sum(fn (AiCall $c) => (int) $c->prompt_tokens + (int) $c->completion_tokens);
        $conversations = $calls->whereNotNull('conversation_id')->pluck('conversation_id')->unique()->count();
        $conversationTokens = (int) $calls->whereNotNull('conversation_id')->sum(fn (AiCall $c) => (int) $c->prompt_tokens + (int) $c->completion_tokens);

        return [
            'total' => $calls->count(),
            'berhasil' => $calls->where('status', AiCall::STATUS_OK)->count(),
            'gagal' => $failed,
            'ditolak' => $calls->where('status', AiCall::STATUS_REJECTED)->count(),
            'cadangan' => $calls->whereIn('status', [AiResult::FALLBACK, AiResult::SKIPPED])->count(),
            'tingkat_galat' => $provider->isEmpty() ? null : round($failed / $provider->count() * 100, 1),
            'p50_ms' => $this->percentile($latencies, 0.5),
            'p95_ms' => $this->percentile($latencies, 0.95),
            'token' => $tokens,
            'percakapan' => $conversations,
            'token_per_percakapan' => $conversations === 0 ? null : (int) round($conversationTokens / $conversations),
        ];
    }

    /** @param  list<int>  $sorted */
    private function percentile(array $sorted, float $p): ?int
    {
        return $sorted === [] ? null : $sorted[max(0, (int) ceil(count($sorted) * $p) - 1)];
    }

    /**
     * Status penyedia untuk Super Admin, urut dari yang paling mendesak.
     *
     * @param  array<string, int|float|null>  $today
     * @return array{kode: string, label: string, keterangan: string, sampai: string|null}
     */
    private function status(array $today): array
    {
        $status = fn (string $kode, string $label, string $keterangan, ?string $sampai = null) => compact('kode', 'label', 'keterangan', 'sampai');

        if (! config('services.ai.enabled')) {
            return $status('nonaktif', 'AI dimatikan', 'AI_ENABLED=false: semua percakapan langsung ditangani petugas.');
        }
        if (($until = $this->breaker->openUntil()) !== null) {
            return $status('sirkuit_terbuka', 'Sirkuit terbuka', 'Penyedia gagal berulang. TARA tidak memanggil model dan meneruskan warga ke petugas sampai sirkuit menutup.', CarbonImmutable::createFromTimestamp($until)->toIso8601String());
        }
        if ($this->budget->exhausted()) {
            return $status('anggaran_habis', 'Anggaran habis', 'Token hari ini sudah mencapai AI_DAILY_TOKEN_BUDGET. TARA meneruskan warga ke petugas sampai tengah malam WIB.', CarbonImmutable::now(self::TZ)->addDay()->startOfDay()->toIso8601String());
        }
        if (config('services.ai.driver') === 'fake') {
            return $status('uji', 'Mode uji', 'AI_DRIVER=fake: jawaban dibuat tanpa model sungguhan.');
        }
        if (($today['tingkat_galat'] ?? 0) >= 20 && ($today['gagal'] ?? 0) >= 3) {
            return $status('terganggu', 'Banyak galat', 'Lebih dari 20% panggilan hari ini gagal. Periksa kode galat terakhir di bawah.');
        }

        return $status('normal', 'Normal', 'Penyedia menjawab dan sirkuit tertutup.');
    }

    /** @return array{terpakai: int, batas: int, persen: float|null, kegagalan_terbaru: int} */
    private function budgetInfo(): array
    {
        $limit = $this->budget->limit();
        $used = $this->budget->used();

        return [
            'terpakai' => $used,
            'batas' => $limit,
            'persen' => $limit > 0 ? round($used / $limit * 100, 1) : null,
            'kegagalan_terbaru' => $this->breaker->recentFailures(),
        ];
    }

    /** @return array{menunggu: int|null, gagal_24_jam: int|null} */
    private function queueInfo(): array
    {
        $queue = (string) config('services.ai.queue', 'ai');

        try {
            $waiting = Queue::size($queue);
        } catch (Throwable) {
            $waiting = null;
        }
        try {
            $failed = DB::table('failed_jobs')->where('queue', $queue)->where('failed_at', '>=', now()->subDay())->count();
        } catch (Throwable) {
            $failed = null;
        }

        return ['menunggu' => $waiting, 'gagal_24_jam' => $failed];
    }

    /**
     * Panggilan per hari (WIB) untuk grafik kolom bertumpuk.
     *
     * @param  Collection<int, AiCall>  $calls
     * @return list<array{tanggal: string, berhasil: int, ditolak: int, cadangan: int, gagal: int, p95_ms: int|null}>
     */
    private function trend(Collection $calls, CarbonImmutable $today): array
    {
        $byDay = $calls->groupBy(fn (AiCall $c) => $c->created_at->setTimezone(self::TZ)->format('Y-m-d'));

        return collect(range(self::TREND_DAYS - 1, 0))->map(function (int $back) use ($byDay, $today) {
            $day = $today->subDays($back)->format('Y-m-d');
            $s = $this->summarize($byDay->get($day, collect()));

            return [
                'tanggal' => $day,
                'berhasil' => (int) $s['berhasil'],
                'ditolak' => (int) $s['ditolak'],
                'cadangan' => (int) $s['cadangan'],
                'gagal' => (int) $s['gagal'],
                'p95_ms' => $s['p95_ms'],
            ];
        })->all();
    }
}
