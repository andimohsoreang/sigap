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
