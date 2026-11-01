import { ColumnChart, StackedBarChart, type ChartSeries } from '@/components/sigap/charts';
import AdminLayout, { AdminStat, Pill } from '@/layouts/admin-layout';
import { formatDateTime } from '@/lib/sigap';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Coins, Gauge, PauseCircle, PhoneCall, RefreshCw, ShieldAlert, Timer, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type Tone = 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'primary';

interface Summary {
    total: number;
    berhasil: number;
    gagal: number;
    ditolak: number;
    cadangan: number;
    tingkat_galat: number | null;
    p50_ms: number | null;
    p95_ms: number | null;
    token: number;
    percakapan: number;
    token_per_percakapan: number | null;
}

interface QualityRun {
    id: number;
    waktu: string | null;
    model: string | null;
    dengan_model: boolean;
    lulus: boolean | null;
    pencarian: [number, number];
    klasifikasi: [number, number];
    tanpa_sumber: number;
    gagal: number;
    angka_ditolak: number;
    median_ms: number | null;
    p95_ms: number | null;
    alasan: string | null;
}

interface Props {
    status: { kode: string; label: string; keterangan: string; sampai: string | null };
    hari_ini: Summary;
    per_tugas: (Summary & { tugas: string })[];
    anggaran: { terpakai: number; batas: number; persen: number | null; kegagalan_terbaru: number };
    antrean: { menunggu: number | null; gagal_24_jam: number | null };
    tren: { tanggal: string; berhasil: number; ditolak: number; cadangan: number; gagal: number; p95_ms: number | null }[];
    galat_terakhir: { id: number; tugas: string; status: string; kode: string | null; latency_ms: number; waktu: string | null }[];
    uji: QualityRun[];
    konfigurasi: {
        aktif: boolean;
        driver: string;
        model: string;
        penyedia: string | null;
        asinkron: boolean;
        ambang_sirkuit: number;
        jeda_sirkuit: number;
        batas_per_percakapan: number;
    };
}

const nf = (n: number) => n.toLocaleString('id-ID');
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} dtk`);
const percent = ([hits, total]: [number, number]) => (total === 0 ? '—' : `${Math.round((hits / total) * 100)}%`);

const TASK_LABEL: Record<string, string> = {
    jawab: 'Jawab warga (TARA)',
    saran_tiket: 'Saran tiket untuk petugas',
    usul_artikel: 'Usulan artikel dari dokumen',
};

const CALL_STATUS: Record<string, { label: string; tone: Tone }> = {
    error: { label: 'Galat', tone: 'danger' },
    timeout: { label: 'Batas waktu', tone: 'danger' },
    fallback: { label: 'Cadangan', tone: 'warning' },
    ditolak: { label: 'Ditolak pengaman', tone: 'warning' },
};

/** Arti kode galat untuk Super Admin (bukan pengembang). */
function errorMeaning(code: string | null): string {
    if (!code) return '—';
    if (code === 'timeout') return 'Penyedia tidak menjawab dalam batas waktu';
    if (code === 'koneksi') return 'Tidak dapat terhubung ke penyedia';
    if (code === 'kosong') return 'Model membalas kosong';
    if (code === 'json_tidak_valid') return 'Balasan model tidak sesuai format';
    if (code === 'angka_tanpa_dasar') return 'Angka di jawaban tidak ada di sumber resmi';
    if (code === 'http_401' || code === 'http_403') return 'Kunci API ditolak penyedia';
    if (code === 'http_429') return 'Terlalu banyak permintaan / kuota penyedia';
    if (/^http_5\d\d$/.test(code)) return 'Server penyedia bermasalah';
    if (/^http_\d+$/.test(code)) return 'Permintaan ditolak penyedia';
    return code;
}

const STATUS_STYLE: Record<string, { tone: Tone; icon: LucideIcon; box: string }> = {
    normal: { tone: 'success', icon: CheckCircle2, box: 'border-[var(--adm-border)] bg-[var(--adm-success-soft)]' },
    uji: { tone: 'info', icon: Gauge, box: 'border-[var(--adm-border)] bg-[var(--adm-info-soft)]' },
    nonaktif: { tone: 'neutral', icon: PauseCircle, box: 'border-[var(--adm-border)] bg-[var(--adm-surface-2)]' },
    terganggu: { tone: 'warning', icon: AlertTriangle, box: 'border-[var(--adm-border)] bg-[var(--adm-warning-soft)]' },
    sirkuit_terbuka: { tone: 'danger', icon: ShieldAlert, box: 'border-[var(--acd-danger-border,#f4c7c2)] bg-[var(--adm-danger-soft)]' },
    anggaran_habis: { tone: 'danger', icon: Coins, box: 'border-[var(--acd-danger-border,#f4c7c2)] bg-[var(--adm-danger-soft)]' },
};

const TREND_SERIES: ChartSeries[] = [
    { key: 'berhasil', label: 'Berhasil', color: 'var(--adm-success)' },
    { key: 'ditolak', label: 'Ditolak pengaman', color: 'var(--adm-info)' },
    { key: 'cadangan', label: 'Cadangan / dilewati', color: 'var(--adm-warning)' },
    { key: 'gagal', label: 'Galat', color: 'var(--adm-danger)' },
];

export default function KesehatanAi(props: Props) {
    const {
        status,
        hari_ini: today,
        per_tugas: perTask,
        anggaran: budget,
        antrean: queue,
        tren,
        galat_terakhir: errors,
        uji,
        konfigurasi: cfg,
    } = props;
    const [refreshing, setRefreshing] = useState(false);
    const style = STATUS_STYLE[status.kode] ?? STATUS_STYLE.normal;
    const StatusIcon = style.icon;
    const errorRateHigh = (today.tingkat_galat ?? 0) >= 20 && today.gagal >= 3;
    const trendRows = tren.map((d) => {
        const date = new Date(`${d.tanggal}T00:00:00`);
        return {
            key: d.tanggal,
            short: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            label: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
            values: { berhasil: d.berhasil, ditolak: d.ditolak, cadangan: d.cadangan, gagal: d.gagal },
        };
    });

    const refresh = () =>
        router.reload({
            onStart: () => setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });

    return (
        <AdminLayout
            title="Kesehatan AI"
            subtitle="Pantau penyedia model, galat, waktu respons, dan pemakaian token TARA. Hanya angka — tanpa isi percakapan."
            actions={
                <button
                    type="button"
                    onClick={refresh}
                    disabled={refreshing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] px-3.5 text-sm font-medium text-[var(--adm-text)] hover:bg-[var(--adm-surface-2)] disabled:opacity-60"
                >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
                    Muat ulang
                </button>
            }
        >
            <div className="space-y-6">
                {/* Status penyedia */}
                <section className={cn('rounded-xl border p-5 md:p-6', style.box)} aria-labelledby="status-ai">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-3">
                            <StatusIcon className="mt-0.5 h-6 w-6 shrink-0 text-[var(--adm-text)]" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--adm-text-2)] uppercase">Status penyedia</p>
                                <h2 id="status-ai" className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold text-[var(--adm-text)]">
                                    {status.label}
                                    <Pill tone={style.tone}>
                                        {status.kode === 'normal' ? 'Berjalan' : status.kode === 'uji' ? 'Tanpa model' : 'Perlu perhatian'}
                                    </Pill>
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm text-[var(--adm-text-2)]">{status.keterangan}</p>
                                {status.sampai && (
                                    <p className="mt-1 text-sm font-medium text-[var(--adm-text)]">Sampai {formatDateTime(status.sampai)}</p>
                                )}
                            </div>
                        </div>
                        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4 lg:grid-cols-2">
                            <Fact label="Penyedia" value={cfg.penyedia ?? '—'} />
                            <Fact label="Model" value={cfg.driver === 'fake' ? 'fake (uji)' : cfg.model} />
                            <Fact label="Jalur jawaban" value={cfg.asinkron ? 'Antrean (asinkron)' : 'Langsung (sinkron)'} />
                            <Fact label="Batas per percakapan" value={`${cfg.batas_per_percakapan} jawaban/jam`} />
                        </dl>
                    </div>
                </section>

                {/* Angka hari ini */}
                <section aria-labelledby="hari-ini">
                    <h2 id="hari-ini" className="sr-only">
                        Angka hari ini
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <AdminStat
                            label="Panggilan hari ini"
                            value={nf(today.total)}
                            icon={PhoneCall}
                            hint={`${nf(today.berhasil)} berhasil · ${nf(today.cadangan)} cadangan · ${nf(today.ditolak)} ditolak pengaman`}
                        />
                        <AdminStat
                            label="Tingkat galat"
                            value={today.tingkat_galat === null ? '—' : `${today.tingkat_galat.toLocaleString('id-ID')}%`}
                            icon={AlertTriangle}
                            tone={errorRateHigh ? 'red' : 'brand'}
                            hint={`${nf(today.gagal)} galat/batas waktu dari panggilan ke penyedia`}
                        />
                        <AdminStat
                            label="Waktu respons P95"
                            value={seconds(today.p95_ms)}
                            icon={Timer}
                            hint={`P50 ${seconds(today.p50_ms)} · sasaran P95 < 12 dtk`}
                        />
                        <AdminStat
                            label="Token hari ini"
                            value={nf(today.token)}
                            icon={Coins}
                            hint={
                                today.token_per_percakapan === null
                                    ? 'Belum ada percakapan warga hari ini'
                                    : `± ${nf(today.token_per_percakapan)} token per percakapan (${nf(today.percakapan)} percakapan)`
                            }
                        />
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <BudgetCard budget={budget} />
                    <Card eyebrow="Ketahanan" title="Antrean & pemutus sirkuit">
                        <dl className="mt-4 divide-y divide-[var(--adm-border)] text-sm">
                            <Row label="Menunggu di antrean jawaban" value={queue.menunggu === null ? '—' : nf(queue.menunggu)} />
                            <Row
                                label="Job jawaban gagal (24 jam)"
                                value={queue.gagal_24_jam === null ? '—' : nf(queue.gagal_24_jam)}
                                tone={(queue.gagal_24_jam ?? 0) > 0 ? 'warning' : undefined}
                            />
                            <Row
                                label="Kegagalan penyedia (2 menit terakhir)"
                                value={`${budget.kegagalan_terbaru} dari ${cfg.ambang_sirkuit}`}
                                tone={budget.kegagalan_terbaru > 0 ? 'warning' : undefined}
                            />
                        </dl>
                        <p className="mt-3 text-xs text-[var(--adm-text-3)]">
                            Sirkuit terbuka setelah {cfg.ambang_sirkuit} kegagalan dalam 2 menit, lalu menutup setelah{' '}
                            {Math.round(cfg.jeda_sirkuit / 60)} menit. Selama terbuka, warga langsung diteruskan ke petugas.
                        </p>
                    </Card>
                </div>

                {/* Per tugas */}
                <Card eyebrow="Hari ini" title="Panggilan per tugas">
                    {/* Ponsel: satu kartu per tugas; layar lebar: tabel. */}
                    <ul className="mt-4 space-y-3 md:hidden">
                        {perTask.map((t) => (
                            <li key={t.tugas} className="rounded-lg border border-[var(--adm-border)] p-3.5">
                                <p className="text-sm font-semibold text-[var(--adm-text)]">{TASK_LABEL[t.tugas] ?? t.tugas}</p>
                                <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-[13px] tabular-nums">
                                    <MiniFact label="Panggilan" value={nf(t.total)} />
                                    <MiniFact label="Galat" value={nf(t.gagal)} alert={t.gagal > 0} />
                                    <MiniFact label="Cadangan" value={nf(t.cadangan)} />
                                    <MiniFact label="P50" value={seconds(t.p50_ms)} />
                                    <MiniFact label="P95" value={seconds(t.p95_ms)} />
                                    <MiniFact label="Token" value={nf(t.token)} />
                                </dl>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <caption className="sr-only">Panggilan AI hari ini per tugas</caption>
                            <thead>
                                <tr className="border-b border-[var(--adm-border)] text-left text-xs text-[var(--adm-text-2)]">
                                    <th scope="col" className="py-2 pr-3 font-semibold">
                                        Tugas
                                    </th>
                                    {['Panggilan', 'Berhasil', 'Galat', 'Cadangan', 'Ditolak', 'P50', 'P95', 'Token'].map((h) => (
                                        <th key={h} scope="col" className="px-3 py-2 text-right font-semibold">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--adm-border)] tabular-nums">
                                {perTask.map((t) => (
                                    <tr key={t.tugas}>
                                        <th scope="row" className="py-2.5 pr-3 text-left font-medium text-[var(--adm-text)]">
                                            {TASK_LABEL[t.tugas] ?? t.tugas}
                                        </th>
                                        <td className="px-3 text-right">{nf(t.total)}</td>
                                        <td className="px-3 text-right">{nf(t.berhasil)}</td>
                                        <td className={cn('px-3 text-right', t.gagal > 0 && 'font-semibold text-[var(--adm-danger)]')}>
                                            {nf(t.gagal)}
                                        </td>
                                        <td className="px-3 text-right">{nf(t.cadangan)}</td>
                                        <td className="px-3 text-right">{nf(t.ditolak)}</td>
                                        <td className="px-3 text-right">{seconds(t.p50_ms)}</td>
                                        <td className="px-3 text-right">{seconds(t.p95_ms)}</td>
                                        <td className="px-3 text-right">{nf(t.token)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-[var(--adm-text-3)]">
                        Cadangan = model tidak dipanggil (sirkuit terbuka, anggaran habis, batas per percakapan) atau balasan tidak sesuai format;
                        warga diteruskan ke petugas. Ditolak = jawaban memuat angka yang tidak ada di sumber resmi.
                    </p>
                </Card>

                {/* Tren: 14 kolom di layar lebar; 7 batang mendatar di layar sempit agar tanggal tetap terbaca. */}
                <Card eyebrow="Tren harian" title="Panggilan AI per hari">
                    <div className="mt-4 hidden lg:block">
                        <ColumnChart
                            label={`Panggilan AI per hari menurut hasil, ${tren.length} hari terakhir`}
                            series={TREND_SERIES}
                            groups={trendRows.map((d) => ({ ...d, label: d.short }))}
                        />
                        <p className="mt-3 text-xs text-[var(--adm-text-3)]">{tren.length} hari terakhir (WIB).</p>
                    </div>
                    <div className="mt-4 lg:hidden">
                        <StackedBarChart
                            label="Panggilan AI per hari menurut hasil, 7 hari terakhir"
                            series={TREND_SERIES}
                            rows={trendRows.slice(-7).reverse()}
                        />
                        <p className="mt-3 text-xs text-[var(--adm-text-3)]">
                            7 hari terakhir (WIB), terbaru di atas. Layar lebar menampilkan {tren.length} hari.
                        </p>
                    </div>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <QualityCard runs={uji} />

                    <Card eyebrow="Diagnosis" title="Galat terakhir">
                        {errors.length === 0 ? (
                            <p className="mt-4 rounded-lg bg-[var(--adm-surface-2)] px-4 py-6 text-center text-sm text-[var(--adm-text-2)]">
                                Belum ada galat tercatat.
                            </p>
                        ) : (
                            <ul className="mt-4 divide-y divide-[var(--adm-border)]">
                                {errors.map((e) => {
                                    const s = CALL_STATUS[e.status] ?? { label: e.status, tone: 'neutral' as Tone };
                                    return (
                                        <li key={e.id} className="py-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="min-w-0 text-[13px] font-medium text-[var(--adm-text)]">
                                                    {TASK_LABEL[e.tugas] ?? e.tugas}
                                                </span>
                                                <time
                                                    dateTime={e.waktu ?? undefined}
                                                    className="shrink-0 text-xs whitespace-nowrap text-[var(--adm-text-3)] tabular-nums"
                                                >
                                                    {formatDateTime(e.waktu)}
                                                </time>
                                            </div>
                                            <div className="mt-1.5 flex items-start gap-2">
                                                <Pill tone={s.tone}>{s.label}</Pill>
                                                <p className="min-w-0 text-[13px] leading-snug text-[var(--adm-text-2)]">
                                                    {errorMeaning(e.kode)}
                                                    {e.kode && <span className="ml-1.5 font-mono text-xs text-[var(--adm-text-3)]">({e.kode})</span>}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}

/* ------------------------------ Komponen ------------------------------- */

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] p-5 md:p-6">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--adm-text-3)] uppercase">{eyebrow}</p>
            <h2 className="mt-1 text-lg leading-snug font-bold text-[var(--adm-text)]">{title}</h2>
            {children}
        </section>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-[var(--adm-text-2)]">{label}</dt>
            <dd className="font-medium break-words text-[var(--adm-text)]">{value}</dd>
        </div>
    );
}

function MiniFact({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-[var(--adm-text-2)]">{label}</dt>
            <dd className={cn('font-semibold', alert ? 'text-[var(--adm-danger)]' : 'text-[var(--adm-text)]')}>{value}</dd>
        </div>
    );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-[var(--adm-text-2)]">{label}</dt>
            <dd className="shrink-0 font-semibold whitespace-nowrap text-[var(--adm-text)] tabular-nums">
                {tone ? <Pill tone={tone}>{value}</Pill> : value}
            </dd>
        </div>
    );
}

function BudgetCard({ budget }: { budget: Props['anggaran'] }) {
    const unlimited = budget.batas === 0;
    const pct = budget.persen ?? 0;
    const tone: Tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
    const bar = { danger: 'var(--adm-danger)', warning: 'var(--adm-warning)', success: 'var(--adm-success)' }[
        tone as 'danger' | 'warning' | 'success'
    ];

    return (
        <Card eyebrow="Biaya" title="Anggaran token harian">
            {unlimited ? (
                <>
                    <p className="mt-4 text-sm text-[var(--adm-text-2)]">
                        <span className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--adm-text)] tabular-nums">
                            {nf(budget.terpakai)}
                        </span>{' '}
                        token terpakai hari ini
                    </p>
                    <p className="mt-3 rounded-lg bg-[var(--adm-surface-2)] px-3 py-2.5 text-[13px] text-[var(--adm-text-2)]">
                        Tanpa batas harian. Isi <code className="font-mono text-xs">AI_DAILY_TOKEN_BUDGET</code> agar Super Admin diberi tahu di 80%
                        dan TARA berhenti memanggil model di 100%.
                    </p>
                </>
            ) : (
                <>
                    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm text-[var(--adm-text-2)]">
                            <span className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--adm-text)] tabular-nums">
                                {nf(budget.terpakai)}
                            </span>{' '}
                            dari {nf(budget.batas)} token
                        </p>
                        <Pill tone={tone}>{`${pct.toLocaleString('id-ID')}%`}</Pill>
                    </div>
                    <div
                        className="relative mt-3 h-3 overflow-hidden rounded-full bg-[var(--adm-surface-2)]"
                        role="progressbar"
                        aria-label="Pemakaian anggaran token hari ini"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, pct)}
                    >
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: bar }} />
                        <span className="absolute inset-y-0 left-[80%] w-px bg-[var(--adm-text-3)]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xs text-[var(--adm-text-3)]">
                        Garis = 80%: Super Admin diberi tahu. Di 100%, TARA meneruskan warga ke petugas sampai tengah malam WIB.
                    </p>
                </>
            )}
        </Card>
    );
}

function QualityCard({ runs }: { runs: QualityRun[] }) {
    const last = runs[0];

    return (
        <Card eyebrow="Gerbang kualitas" title="Uji kualitas TARA">
            {!last ? (
                <p className="mt-4 rounded-lg bg-[var(--adm-surface-2)] px-4 py-6 text-center text-sm text-[var(--adm-text-2)]">
                    Belum ada hasil uji tersimpan. Uji berjalan otomatis tiap Senin 03.00 WIB bila model sungguhan aktif.
                </p>
            ) : (
                <>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Pill tone={last.lulus === false ? 'danger' : last.lulus ? 'success' : 'neutral'}>
                            {last.lulus === false ? 'Gagal' : last.lulus ? 'Lulus' : 'Tanpa ambang'}
                        </Pill>
                        <span className="text-[13px] text-[var(--adm-text-2)]">
                            Terakhir {formatDateTime(last.waktu)}
                            {last.model && ` · ${last.model}`}
                        </span>
                    </div>
                    {last.alasan && <p className="mt-2 text-[13px] text-[var(--adm-danger)]">Tidak memenuhi: {last.alasan}</p>}
                    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric
                            label="Pencarian tepat"
                            value={percent(last.pencarian)}
                            sub={`${last.pencarian[0]}/${last.pencarian[1]} · ambang 95%`}
                        />
                        <Metric
                            label="Klasifikasi tepat"
                            value={last.dengan_model ? percent(last.klasifikasi) : '—'}
                            sub={last.dengan_model ? `${last.klasifikasi[0]}/${last.klasifikasi[1]} · ambang 85%` : 'tanpa model'}
                        />
                        <Metric label="Tanpa sumber" value={last.dengan_model ? nf(last.tanpa_sumber) : '—'} sub="ambang 0" />
                        <Metric label="Waktu jawab P95" value={seconds(last.p95_ms)} sub={`median ${seconds(last.median_ms)}`} />
                    </dl>

                    {runs.length > 1 && (
                        <ul
                            className="mt-5 divide-y divide-[var(--adm-border)] border-t border-[var(--adm-border)] md:hidden"
                            aria-label="Riwayat uji kualitas"
                        >
                            {runs.map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                                    <div className="min-w-0">
                                        <p className="text-[var(--adm-text)]">{formatDateTime(r.waktu)}</p>
                                        <p className="text-xs text-[var(--adm-text-2)] tabular-nums">
                                            Pencarian {percent(r.pencarian)}
                                            {r.dengan_model && ` · klasifikasi ${percent(r.klasifikasi)} · P95 ${seconds(r.p95_ms)}`}
                                        </p>
                                    </div>
                                    <Pill tone={r.lulus === false ? 'danger' : r.lulus ? 'success' : 'neutral'}>
                                        {r.lulus === false ? 'Gagal' : r.lulus ? 'Lulus' : '—'}
                                    </Pill>
                                </li>
                            ))}
                        </ul>
                    )}
                    {runs.length > 1 && (
                        <div className="mt-5 hidden md:block">
                            <table className="w-full text-[13px]">
                                <caption className="mb-2 text-left text-xs font-semibold text-[var(--adm-text-2)]">Riwayat uji</caption>
                                <thead>
                                    <tr className="border-b border-[var(--adm-border)] text-left text-xs text-[var(--adm-text-2)]">
                                        <th scope="col" className="py-2 pr-3 font-semibold">
                                            Waktu
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Hasil
                                        </th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold">
                                            Pencarian
                                        </th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold">
                                            Klasifikasi
                                        </th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold">
                                            P95
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--adm-border)] tabular-nums">
                                    {runs.map((r) => (
                                        <tr key={r.id}>
                                            <td className="py-2 pr-3 text-[var(--adm-text-2)]">{formatDateTime(r.waktu)}</td>
                                            <td className="px-3">
                                                <Pill tone={r.lulus === false ? 'danger' : r.lulus ? 'success' : 'neutral'}>
                                                    {r.lulus === false ? 'Gagal' : r.lulus ? 'Lulus' : '—'}
                                                </Pill>
                                            </td>
                                            <td className="px-3 text-right">{percent(r.pencarian)}</td>
                                            <td className="px-3 text-right">{r.dengan_model ? percent(r.klasifikasi) : '—'}</td>
                                            <td className="px-3 text-right">{seconds(r.p95_ms)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="rounded-lg bg-[var(--adm-surface-2)] p-3">
            <dt className="text-xs text-[var(--adm-text-2)]">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-[var(--adm-text)] tabular-nums">{value}</dd>
            <dd className="mt-0.5 text-xs text-[var(--adm-text-3)]">{sub}</dd>
        </div>
    );
}
