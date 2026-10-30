import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Dasar hukum Sumber Resmi / artikel (PRD-AI FR-AI-11). */
export type StatusDasar = 'berlaku' | 'diganti' | 'belum_diketahui';

export type LegalBasis = {
    dasar_hukum: string;
    tanggal_dasar: string;
    status_dasar: StatusDasar;
    diganti_oleh: string;
};

export const STATUS_DASAR_LABEL: Record<StatusDasar, string> = {
    berlaku: 'Berlaku',
    diganti: 'Sudah diganti',
    belum_diketahui: 'Belum diketahui',
};

export const EMPTY_LEGAL_BASIS: LegalBasis = { dasar_hukum: '', tanggal_dasar: '', status_dasar: 'belum_diketahui', diganti_oleh: '' };

/** Nilai dari server (bisa null) → nilai formulir. */
export function legalBasisFrom(row: {
    dasar_hukum: string | null;
    tanggal_dasar: string | null;
    status_dasar: StatusDasar | null;
    diganti_oleh: string | null;
}): LegalBasis {
    return {
        dasar_hukum: row.dasar_hukum ?? '',
        tanggal_dasar: row.tanggal_dasar ?? '',
        status_dasar: row.status_dasar ?? 'belum_diketahui',
        diganti_oleh: row.diganti_oleh ?? '',
    };
}

/**
 * Isian dasar hukum. Asisten AI memakai label ini untuk memilih aturan yang
 * berlaku bila dua sumber berbeda; isi hanya dari naskah peraturan resmi.
 */
export function LegalBasisFields({
    value,
    onChange,
    errors = {},
    className,
}: {
    value: LegalBasis;
    onChange: (field: keyof LegalBasis, value: string) => void;
    errors?: Partial<Record<keyof LegalBasis, string>>;
    className?: string;
}) {
    return (
        <div className={cn('grid gap-4 md:grid-cols-2', className)}>
            <BasisField label="Dasar hukum" error={errors.dasar_hukum}>
                <Input
                    value={value.dasar_hukum}
                    onChange={(e) => onChange('dasar_hukum', e.target.value)}
                    placeholder="Mis. Permentrans 3/2026 tentang Transmigrasi Patriot"
                />
            </BasisField>
            <BasisField label="Tanggal penetapan" error={errors.tanggal_dasar}>
                <Input type="date" value={value.tanggal_dasar} onChange={(e) => onChange('tanggal_dasar', e.target.value)} />
            </BasisField>
            <BasisField label="Status aturan" error={errors.status_dasar}>
                <Select value={value.status_dasar} onValueChange={(v) => onChange('status_dasar', v as StatusDasar)}>
                    <SelectTrigger aria-label="Status aturan">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.keys(STATUS_DASAR_LABEL) as StatusDasar[]).map((s) => (
                            <SelectItem key={s} value={s}>
                                {STATUS_DASAR_LABEL[s]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </BasisField>
            <BasisField label="Diganti oleh" error={errors.diganti_oleh}>
                <Input
                    value={value.diganti_oleh}
                    onChange={(e) => onChange('diganti_oleh', e.target.value)}
                    disabled={value.status_dasar !== 'diganti'}
                    placeholder="Peraturan pengganti"
                />
            </BasisField>
            <p className="text-xs text-gray-500 md:col-span-2">
                Bila dua sumber berbeda (mis. batas usia), asisten AI menjawab dengan yang berstatus &ldquo;Berlaku&rdquo; dan menyebut yang
                &ldquo;Sudah diganti&rdquo; sebagai aturan lama. Bila belum diketahui, warga diteruskan ke petugas. Isi hanya dari naskah peraturan
                resmi.
            </p>
        </div>
    );
}

function BasisField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{label}</Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
