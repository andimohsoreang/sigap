import { useState } from 'react';

import { cn } from '@/lib/utils';

/** Diagram SVG ringan untuk panel admin (tanpa pustaka grafik). */

const nf = (n: number) => n.toLocaleString('id-ID');

export interface TrendPoint {
    key: string;
    label: string;
    masuk: number;
    selesai: number;
}

const SERIES = [
    { key: 'masuk', label: 'Masuk', color: 'var(--adm-primary)' },
    { key: 'selesai', label: 'Selesai', color: 'var(--adm-success)' },
] as const;

/** Garis/area tiket masuk vs selesai, dengan penanda nilai saat disorot. */
export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: 'hari' | 'bulan' }) {
    const [active, setActive] = useState<number | null>(null);
    const W = 640;
    const H = 220;
    const pad = { top: 16, right: 12, bottom: 28, left: 34 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const max = Math.max(1, ...points.flatMap((p) => [p.masuk, p.selesai]));
    const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
    const line = (key: 'masuk' | 'selesai') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    const area = `${line('masuk')} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    const labelEvery = Math.max(1, Math.ceil(points.length / 8));
    const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];
    const point = active === null ? null : points[active];

    const onMove = (e: React.MouseEvent<SVGRectElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
    };

    if (points.length === 0) {
        return <p className="py-10 text-center text-sm text-[var(--adm-text-2)]">Belum ada data.</p>;
    }

    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[var(--adm-text-2)]">
                {SERIES.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                        <span className="h-2 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                        {s.label}
                        <span className="font-semibold text-[var(--adm-text)] tabular-nums">{nf(points.reduce((n, p) => n + p[s.key], 0))}</span>
                    </span>
                ))}
                {point && (
                    <span className="ml-auto rounded-md bg-[var(--adm-surface-2)] px-2 py-0.5 font-medium text-[var(--adm-text)]">
                        {unit === 'hari' ? `Tanggal ${point.label}` : point.label}: {nf(point.masuk)} masuk · {nf(point.selesai)} selesai
                    </span>
                )}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Tren tiket masuk dan selesai per ${unit}`}>
                {ticks.map((t) => (
                    <g key={t}>
                        <line
                            x1={pad.left}
                            x2={W - pad.right}
                            y1={y(t)}
                            y2={y(t)}
                            stroke="var(--adm-border)"
                            strokeDasharray={t === 0 ? undefined : '3 4'}
                        />
                        <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--adm-text-3)">
                            {nf(t)}
                        </text>
                    </g>
                ))}
                {points.map((p, i) =>
                    i % labelEvery === 0 || i === points.length - 1 ? (
                        <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--adm-text-3)">
                            {p.label}
                        </text>
                    ) : null,
                )}
                <path d={area} fill="var(--adm-primary)" opacity="0.08" />
                {SERIES.map((s) => (
                    <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {point && active !== null && (
                    <g>
                        <line x1={x(active)} x2={x(active)} y1={pad.top} y2={y(0)} stroke="var(--adm-text-3)" strokeDasharray="2 3" />
                        {SERIES.map((s) => (
                            <circle key={s.key} cx={x(active)} cy={y(point[s.key])} r="4" fill="white" stroke={s.color} strokeWidth="2" />
                        ))}
                    </g>
                )}
                <rect
                    x={pad.left}
                    y={pad.top}
                    width={innerW}
                    height={innerH}
                    fill="transparent"
                    onMouseMove={onMove}
                    onMouseLeave={() => setActive(null)}
                />
            </svg>
        </div>
    );
}

export interface DonutSegment {
    key: string;
    label: string;
    value: number;
    color: string;
    href?: string;
}

/** Donat komposisi dengan total di tengah dan legenda berpersentase. */
export function DonutChart({ segments, centerLabel, onSelect }: { segments: DonutSegment[]; centerLabel: string; onSelect?: (key: string) => void }) {
    const total = segments.reduce((n, s) => n + s.value, 0);
    const R = 52;
    const C = 2 * Math.PI * R;
    let offset = 0;

    return (
        <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
            <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0" role="img" aria-label={`${centerLabel}: ${nf(total)}`}>
                <circle cx="70" cy="70" r={R} fill="none" stroke="var(--adm-surface-2)" strokeWidth="18" />
                {total > 0 &&
                    segments.map((s) => {
                        const len = (s.value / total) * C;
                        const dash = (
                            <circle
                                key={s.key}
                                cx="70"
                                cy="70"
                                r={R}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="18"
                                strokeDasharray={`${len} ${C - len}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 70 70)"
                            />
                        );
                        offset += len;
                        return dash;
                    })}
                <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--adm-text)">
                    {nf(total)}
                </text>
                <text x="70" y="86" textAnchor="middle" fontSize="10" fill="var(--adm-text-3)">
                    {centerLabel}
                </text>
            </svg>
            <ul className="w-full min-w-0 space-y-1.5 text-sm">
                {segments.map((s) => (
                    <li key={s.key}>
                        <button
                            type="button"
                            disabled={!onSelect}
                            onClick={() => onSelect?.(s.key)}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left',
                                onSelect && 'hover:bg-[var(--adm-surface-2)]',
                            )}
                        >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-[var(--adm-text-2)]">{s.label}</span>
                            <span className="font-semibold text-[var(--adm-text)] tabular-nums">{nf(s.value)}</span>
                            <span className="w-10 text-right text-xs text-[var(--adm-text-3)] tabular-nums">
                                {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Grafik tambahan Matriks Rekapitulasi (pie, batang bertumpuk, kolom, gauge) */
/* -------------------------------------------------------------------------- */

/** Palet kategorikal; token tema agar ikut mode gelap. */
export const CHART_PALETTE = [
    'var(--adm-primary)',
    'var(--adm-accent)',
    'var(--adm-info)',
    'var(--adm-success)',
    'var(--chart-violet, #6f4fb3)',
    'var(--chart-rose, #b4456c)',
    'var(--chart-teal, #1f7f7f)',
    'var(--adm-text-3)',
];

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

export interface PieSlice {
    key: string;
    label: string;
    value: number;
    color: string;
}

/** Pie penuh: irisan menonjol saat disorot, persentase di dalam irisan besar, legenda bisa diklik. */
export function PieChart({ slices, label, onSelect }: { slices: PieSlice[]; label: string; onSelect?: (key: string) => void }) {
    const [active, setActive] = useState<string | null>(null);
    const data = slices.filter((s) => s.value > 0);
    const total = data.reduce((n, s) => n + s.value, 0);
    const R = 64;
    const C = 80;
    let angle = -Math.PI / 2;
    const current = data.find((s) => s.key === active) ?? null;

    if (total === 0) {
        return <p className="py-10 text-center text-sm text-[var(--adm-text-2)]">Belum ada data.</p>;
    }

    return (
        <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="relative shrink-0">
                <svg
                    viewBox="0 0 160 160"
                    className="h-[170px] w-[170px]"
                    role="img"
                    aria-label={`${label}: ${data.map((s) => `${s.label} ${s.value} (${pct(s.value, total)}%)`).join(', ')}`}
                >
                    {data.map((s) => {
                        const sweep = (s.value / total) * Math.PI * 2;
                        const start = angle;
                        const end = angle + sweep;
                        angle = end;
                        const mid = (start + end) / 2;
                        const lift = active === s.key ? 6 : 0;
                        const dx = Math.cos(mid) * lift;
                        const dy = Math.sin(mid) * lift;
                        const large = sweep > Math.PI ? 1 : 0;
                        const p = (a: number, r = R) => `${(C + Math.cos(a) * r).toFixed(2)},${(C + Math.sin(a) * r).toFixed(2)}`;
                        const d = data.length === 1 ? null : `M${C},${C} L${p(start)} A${R},${R} 0 ${large} 1 ${p(end)} Z`;
                        const share = pct(s.value, total);
                        return (
                            <g
                                key={s.key}
                                transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`}
                                className={cn('transition-transform duration-200', onSelect && 'cursor-pointer')}
                                onMouseEnter={() => setActive(s.key)}
                                onMouseLeave={() => setActive(null)}
                                onClick={() => onSelect?.(s.key)}
                            >
                                {d ? (
                                    <path d={d} fill={s.color} stroke="var(--acd-surface, #fff)" strokeWidth="2" strokeLinejoin="round" />
                                ) : (
                                    <circle cx={C} cy={C} r={R} fill={s.color} />
                                )}
                                {share >= 9 && (
                                    <text
                                        x={C + Math.cos(mid) * R * 0.62}
                                        y={C + Math.sin(mid) * R * 0.62 + 4}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight="700"
                                        fill="#fff"
                                        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.35)', strokeWidth: 2 }}
                                        pointerEvents="none"
                                    >
                                        {share}%
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
                {current && (
                    <span className="pointer-events-none absolute inset-x-0 -bottom-2 mx-auto w-max max-w-[200px] truncate rounded-md bg-[var(--adm-text)] px-2 py-0.5 text-xs font-medium text-[var(--acd-surface,#fff)]">
                        {current.label}: {nf(current.value)} ({pct(current.value, total)}%)
                    </span>
                )}
            </div>
            <Legend items={slices} total={total} active={active} onHover={setActive} onSelect={onSelect} />
        </div>
    );
}

function Legend({
    items,
    total,
    active,
    onHover,
    onSelect,
}: {
    items: PieSlice[];
    total: number;
    active: string | null;
    onHover: (key: string | null) => void;
    onSelect?: (key: string) => void;
}) {
    return (
        <ul className="w-full min-w-0 space-y-1 text-sm">
            {items.map((s) => (
                <li key={s.key}>
                    <button
                        type="button"
                        disabled={!onSelect}
                        onClick={() => onSelect?.(s.key)}
                        onMouseEnter={() => onHover(s.key)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => onHover(s.key)}
                        onBlur={() => onHover(null)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors disabled:cursor-default',
                            (onSelect || active === s.key) && 'hover:bg-[var(--adm-surface-2)]',
                            active === s.key && 'bg-[var(--adm-surface-2)]',
                        )}
                    >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[var(--adm-text-2)]">{s.label}</span>
                        <span className="font-semibold text-[var(--adm-text)] tabular-nums">{nf(s.value)}</span>
                        <span className="w-10 text-right text-xs text-[var(--adm-text-3)] tabular-nums">
                            {total > 0 ? `${pct(s.value, total)}%` : '—'}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

export interface ChartSeries {
    key: string;
    label: string;
    color: string;
}

export interface StackRow {
    key: string;
    label: string;
    values: Record<string, number>;
    href?: string | null;
}

/** Legenda seri yang bisa diklik untuk menyembunyikan/menampilkan seri. */
function SeriesToggle({ series, hidden, onToggle }: { series: ChartSeries[]; hidden: Set<string>; onToggle: (key: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tampilkan seri">
            {series.map((s) => {
                const on = !hidden.has(s.key);
                return (
                    <button
                        key={s.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggle(s.key)}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                            on
                                ? 'border-[var(--adm-border)] text-[var(--adm-text)]'
                                : 'border-dashed border-[var(--adm-border)] text-[var(--adm-text-3)] line-through',
                        )}
                    >
                        <span className="h-2 w-2 rounded-sm" style={{ background: on ? s.color : 'var(--adm-border-strong)' }} aria-hidden="true" />
                        {s.label}
                    </button>
                );
            })}
        </div>
    );
}

function useHiddenSeries() {
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    return [hidden, toggle] as const;
}

/** Batang horizontal bertumpuk per baris (mis. status per provinsi); seri bisa disembunyikan. */
export function StackedBarChart({ rows, series, label }: { rows: StackRow[]; series: ChartSeries[]; label: string }) {
    const [hidden, toggle] = useHiddenSeries();
    const [active, setActive] = useState<string | null>(null);
    const visible = series.filter((s) => !hidden.has(s.key));
    const sum = (r: StackRow) => visible.reduce((n, s) => n + (r.values[s.key] ?? 0), 0);
    const max = Math.max(1, ...rows.map(sum));
    const current = rows.find((r) => r.key === active);

    if (rows.length === 0) {
        return <p className="py-10 text-center text-sm text-[var(--adm-text-2)]">Belum ada data.</p>;
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <SeriesToggle series={series} hidden={hidden} onToggle={toggle} />
                <p className="min-h-5 text-xs text-[var(--adm-text-2)] sm:ml-auto" aria-live="polite">
                    {current
                        ? `${current.label}: ${
                              visible
                                  .filter((s) => (current.values[s.key] ?? 0) > 0)
                                  .map((s) => `${s.label} ${nf(current.values[s.key] ?? 0)}`)
                                  .join(' · ') || 'tidak ada tiket'
                          }`
                        : 'Arahkan kursor ke batang untuk rinciannya.'}
                </p>
            </div>
            <ul className="space-y-2.5" aria-label={label}>
                {rows.map((r) => {
                    const total = sum(r);
                    const name = r.href ? (
                        <a href={r.href} className="truncate hover:text-[var(--acd-link,var(--adm-primary))] hover:underline">
                            {r.label}
                        </a>
                    ) : (
                        <span className="truncate">{r.label}</span>
                    );
                    return (
                        <li
                            key={r.key}
                            className={cn(
                                'grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-md px-1 py-0.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2.5rem]',
                                active === r.key && 'bg-[var(--adm-surface-2)]',
                            )}
                            onMouseEnter={() => setActive(r.key)}
                            onMouseLeave={() => setActive(null)}
                        >
                            <span className="flex min-w-0 text-[13px] text-[var(--adm-text)]">{name}</span>
                            <span
                                className="flex h-5 overflow-hidden rounded-md bg-[var(--adm-surface-2)]"
                                role="img"
                                aria-label={`${r.label}: ${visible.map((s) => `${s.label} ${r.values[s.key] ?? 0}`).join(', ')}`}
                            >
                                <span className="flex h-full" style={{ width: `${(total / max) * 100}%` }}>
                                    {visible.map((s) => {
                                        const v = r.values[s.key] ?? 0;
                                        return v > 0 ? (
                                            <span
                                                key={s.key}
                                                className="h-full border-r border-[var(--acd-surface,#fff)] last:border-r-0"
                                                style={{ width: `${(v / total) * 100}%`, background: s.color }}
                                                title={`${s.label}: ${nf(v)}`}
                                            />
                                        ) : null;
                                    })}
                                </span>
                            </span>
                            <span className="text-right text-[13px] font-semibold text-[var(--adm-text)] tabular-nums">{nf(total)}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export interface ColumnGroup {
    key: string;
    label: string;
    values: Record<string, number>;
}

/** Kolom vertikal bertumpuk dengan sumbu Y, tooltip saat disorot, dan seri yang bisa disembunyikan. */
export function ColumnChart({ groups, series, label }: { groups: ColumnGroup[]; series: ChartSeries[]; label: string }) {
    const [hidden, toggle] = useHiddenSeries();
    const [active, setActive] = useState<string | null>(null);
    const visible = series.filter((s) => !hidden.has(s.key));
    const sum = (g: ColumnGroup) => visible.reduce((n, s) => n + (g.values[s.key] ?? 0), 0);
    const max = Math.max(1, ...groups.map(sum));
    const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const ticks = [niceMax, (niceMax * 3) / 4, niceMax / 2, niceMax / 4, 0];

    return (
        <div>
            <SeriesToggle series={series} hidden={hidden} onToggle={toggle} />
            <div
                className="mt-4 grid grid-cols-[2rem_minmax(0,1fr)] gap-2"
                role="img"
                aria-label={`${label}: ${groups.map((g) => `${g.label} ${visible.map((s) => `${s.label} ${g.values[s.key] ?? 0}`).join(', ')}`).join('; ')}`}
            >
                <div className="relative h-52">
                    {ticks.map((t) => (
                        <span
                            key={t}
                            className="absolute right-0 -translate-y-1/2 text-[10px] text-[var(--adm-text-3)] tabular-nums"
                            style={{ top: `${100 - (t / niceMax) * 100}%` }}
                        >
                            {nf(t)}
                        </span>
                    ))}
                </div>
                <div className="relative h-52">
                    {ticks.map((t) => (
                        <span
                            key={t}
                            className={cn('absolute inset-x-0 border-t border-[var(--adm-border)]', t !== 0 && 'border-dashed')}
                            style={{ top: `${100 - (t / niceMax) * 100}%` }}
                            aria-hidden="true"
                        />
                    ))}
                    <div className="absolute inset-0 flex items-end justify-around gap-3 px-2">
                        {groups.map((g) => {
                            const total = sum(g);
                            return (
                                <div
                                    key={g.key}
                                    className="relative flex h-full w-full max-w-16 flex-col justify-end"
                                    onMouseEnter={() => setActive(g.key)}
                                    onMouseLeave={() => setActive(null)}
                                >
                                    {active === g.key && (
                                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md bg-[var(--adm-text)] px-2.5 py-1.5 text-xs text-[var(--acd-surface,#fff)] shadow-md">
                                            <p className="font-semibold">
                                                {g.label} · {nf(total)}
                                            </p>
                                            {visible.map((s) => (
                                                <p key={s.key} className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                                                    {s.label}: {nf(g.values[s.key] ?? 0)}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    <span className="mb-1 text-center text-[11px] font-semibold text-[var(--adm-text)] tabular-nums">
                                        {total > 0 ? nf(total) : ''}
                                    </span>
                                    <div
                                        className="flex w-full flex-col-reverse overflow-hidden rounded-t-md"
                                        style={{ height: `${(total / niceMax) * 100}%` }}
                                    >
                                        {visible.map((s) => {
                                            const v = g.values[s.key] ?? 0;
                                            return v > 0 ? (
                                                <span
                                                    key={s.key}
                                                    className="w-full border-t border-[var(--acd-surface,#fff)] first:border-t-0"
                                                    style={{ height: `${(v / total) * 100}%`, background: s.color }}
                                                />
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <span />
                <div className="flex justify-around gap-3 px-2">
                    {groups.map((g) => (
                        <span key={g.key} className="w-full max-w-16 truncate text-center text-xs font-medium text-[var(--adm-text-2)]">
                            {g.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Gauge setengah lingkaran 0–100 dengan warna ambang (hijau ≥ good, kuning ≥ warn, merah di bawahnya). */
export function GaugeChart({
    value,
    display,
    label,
    caption,
    good = 90,
    warn = 70,
}: {
    value: number | null;
    display: string;
    label: string;
    caption: string;
    good?: number;
    warn?: number;
}) {
    const R = 70;
    const L = Math.PI * R;
    const v = value === null ? 0 : Math.max(0, Math.min(100, value));
    const color =
        value === null ? 'var(--adm-border-strong)' : v >= good ? 'var(--adm-success)' : v >= warn ? 'var(--adm-warning)' : 'var(--adm-danger)';
    const arc = `M10,85 A${R},${R} 0 0 1 150,85`;

    return (
        <figure className="flex flex-col items-center text-center">
            <svg viewBox="0 0 160 95" className="h-auto w-full max-w-[200px]" role="img" aria-label={`${label}: ${display}`}>
                <path d={arc} fill="none" stroke="var(--adm-surface-2)" strokeWidth="14" strokeLinecap="round" />
                {value !== null && v > 0 && (
                    <path d={arc} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(v / 100) * L} ${L}`} />
                )}
                <text x="80" y="76" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--adm-text)">
                    {display}
                </text>
            </svg>
            <figcaption className="mt-1">
                <span className="block text-sm font-semibold text-[var(--adm-text)]">{label}</span>
                <span className="block text-xs text-[var(--adm-text-2)]">{caption}</span>
            </figcaption>
        </figure>
    );
}
