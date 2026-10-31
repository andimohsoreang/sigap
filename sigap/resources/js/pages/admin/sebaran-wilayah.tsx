import { Link } from '@inertiajs/react';
import { AlertTriangle, ChevronRight, Info, MapPin } from 'lucide-react';

import AdminLayout from '@/layouts/admin-layout';

/** Satu provinsi asal pengaduan (diisi warga di formulir/chat). */
interface Row {
    provinsi: string;
    total: number;
    berjalan: number;
    selesai: number;
    ews: number;
    terakhir: string | null;
    /** Lokasi teratas yang ditulis pelapor (kabupaten/kawasan/desa). */
    lokasi: { nama: string; total: number }[];
}

interface Props {
    rows: Row[];
    tanpa_provinsi: number;
    total: number;
}

const nf = (n: number) => n.toLocaleString('id-ID');
const tanggal = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * Sebaran Wilayah: daftar provinsi & lokasi dari pengaduan yang masuk (bukan
 * data master kawasan). Hanya dibaca; klik provinsi untuk melihat tiketnya.
 */
export default function SebaranWilayah({ rows, tanpa_provinsi: tanpaProvinsi, total }: Props) {
    const max = Math.max(1, ...rows.map((r) => r.total));

    return (
        <AdminLayout
            title="Sebaran Wilayah"
            subtitle={`${nf(rows.length)} provinsi asal · ${nf(total)} pengaduan. Diambil dari pengaduan yang masuk.`}
        >
            <div className="space-y-4">
                <p className="flex items-start gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-info-soft)] px-4 py-3 text-sm text-[var(--adm-text)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-info)]" aria-hidden="true" />
                    Provinsi dipilih warga saat bertanya ke TARA, mengisi formulir, atau oleh petugas di Input Manual. Lokasi adalah teks bebas yang
                    ditulis pelapor (kabupaten, kawasan, atau desa).
                </p>

                {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--adm-border-strong)] bg-[var(--acd-surface,#fff)] p-10 text-center text-sm text-[var(--adm-text-2)]">
                        Belum ada pengaduan yang mencantumkan provinsi.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)]">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--adm-surface-2)] text-xs tracking-[0.06em] text-[var(--adm-text-3)] uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Provinsi</th>
                                    <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Lokasi teratas</th>
                                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                                    <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Berjalan</th>
                                    <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Selesai</th>
                                    <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Lewat SLA</th>
                                    <th className="hidden px-4 py-3 text-right font-semibold xl:table-cell">Terakhir masuk</th>
                                    <th className="w-10 px-2 py-3" aria-hidden="true" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--adm-border)]">
                                {rows.map((r) => (
                                    <tr key={r.provinsi} className="group hover:bg-[var(--adm-surface-2)]">
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/admin/tiket?provinsi=${encodeURIComponent(r.provinsi)}`}
                                                className="flex items-center gap-2 font-semibold text-[var(--adm-text)] hover:text-[var(--acd-link,var(--adm-primary))]"
                                            >
                                                <MapPin className="h-4 w-4 shrink-0 text-[var(--adm-accent)]" aria-hidden="true" />
                                                {r.provinsi}
                                            </Link>
                                            <span
                                                className="mt-1.5 block h-1.5 max-w-[220px] overflow-hidden rounded-full bg-[var(--adm-surface-2)]"
                                                aria-hidden="true"
                                            >
                                                <span
                                                    className="block h-full rounded-full bg-[var(--adm-accent)]"
                                                    style={{ width: `${(r.total / max) * 100}%` }}
                                                />
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-3 text-[var(--adm-text-2)] lg:table-cell">
                                            {r.lokasi.length === 0 ? (
                                                <span className="text-[var(--adm-text-3)]">—</span>
                                            ) : (
                                                <span className="flex flex-wrap gap-1.5">
                                                    {r.lokasi.map((l) => (
                                                        <span key={l.nama} className="rounded-md bg-[var(--adm-surface-2)] px-2 py-0.5 text-xs">
                                                            {l.nama} <span className="text-[var(--adm-text-3)] tabular-nums">· {nf(l.total)}</span>
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-[var(--adm-text)] tabular-nums">{nf(r.total)}</td>
                                        <td className="hidden px-4 py-3 text-right text-[var(--adm-text-2)] tabular-nums sm:table-cell">
                                            {nf(r.berjalan)}
                                        </td>
                                        <td className="hidden px-4 py-3 text-right text-[var(--adm-success)] tabular-nums sm:table-cell">
                                            {nf(r.selesai)}
                                        </td>
                                        <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                                            {r.ews > 0 ? (
                                                <span className="inline-flex items-center gap-1 font-semibold text-[var(--adm-danger)]">
                                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {nf(r.ews)}
                                                </span>
                                            ) : (
                                                <span className="text-[var(--adm-text-3)]">0</span>
                                            )}
                                        </td>
                                        <td className="hidden px-4 py-3 text-right text-[var(--adm-text-3)] xl:table-cell">{tanggal(r.terakhir)}</td>
                                        <td className="px-2 py-3 text-[var(--adm-text-3)]">
                                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tanpaProvinsi > 0 && (
                    <p className="text-xs text-[var(--adm-text-2)]">
                        {nf(tanpaProvinsi)} pengaduan lama belum mencantumkan provinsi dan tidak masuk daftar ini.
                    </p>
                )}
            </div>
        </AdminLayout>
    );
}
