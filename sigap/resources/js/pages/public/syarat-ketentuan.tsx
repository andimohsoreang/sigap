import { Head } from '@inertiajs/react';
import StaticShell, { Section } from './static-shell';

export default function SyaratKetentuan() {
    return (
        <StaticShell title="Syarat dan Ketentuan" subtitle="Ketentuan penggunaan layanan SIGAP bagi seluruh pengguna" updated="Januari 2026">
            <Head title="Syarat dan Ketentuan — SIGAP" />

            <Section title="1. Ketentuan Umum">
                <p>
                    SIGAP ("Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas") adalah sistem elektronik pengelolaan pengaduan masyarakat
                    milik Kementerian Transmigrasi Republik Indonesia. Dengan mengakses dan menggunakan SIGAP, pengguna dianggap telah membaca,
                    memahami, dan menyetujui seluruh ketentuan dalam dokumen ini.
                </p>
            </Section>

            <Section title="2. Kewajiban Pengguna">
                <p>
                    Pengguna wajib memberikan data dan informasi yang benar, akurat, dan dapat dipertanggungjawabkan saat mengajukan aduan atau
                    mendaftarkan akun. Pengguna bertanggung jawab penuh atas kerahasiaan kredensial akunnya sendiri.
                </p>
            </Section>

            <Section title="3. Larangan Penggunaan">
                <p>Pengguna dilarang menggunakan SIGAP untuk:</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                    <li>Menyampaikan laporan palsu, fitnah, atau tidak berdasar dengan itikad tidak baik;</li>
                    <li>Mengunggah konten yang mengandung SARA, ujaran kebencian, atau pornografi;</li>
                    <li>Melakukan spam atau mengirim aduan berulang dengan isi yang identik secara sengaja;</li>
                    <li>Mencoba mengakses, mengubah, atau merusak sistem SIGAP tanpa otorisasi.</li>
                </ul>
            </Section>

            <Section title="4. Hak Pengelola">
                <p>
                    Kementerian Transmigrasi berhak memverifikasi, menunda, atau menutup laporan yang terbukti tidak valid, di luar kewenangan
                    Kementerian, atau melanggar ketentuan ini. Target waktu penyelesaian sebagaimana diatur dalam Pedoman Layanan bersifat estimasi
                    terbaik (best-effort), bukan jaminan mutlak, terutama untuk kasus yang memerlukan koordinasi lintas instansi. Laporan yang
                    terindikasi memuat unsur pidana dapat diteruskan kepada aparat penegak hukum yang berwenang.
                </p>
            </Section>

            <Section title="5. Kekayaan Intelektual">
                <p>
                    Seluruh elemen tampilan, logo, dan konten pada situs SIGAP merupakan hak milik Kementerian Transmigrasi, kecuali dinyatakan lain,
                    dan tidak boleh digandakan untuk kepentingan komersial tanpa izin tertulis.
                </p>
            </Section>

            <Section title="6. Perubahan Ketentuan">
                <p>
                    Ketentuan ini dapat diperbarui sewaktu-waktu untuk menyesuaikan dengan kebijakan atau peraturan perundang-undangan terbaru.
                    Perubahan akan diinformasikan melalui halaman ini.
                </p>
            </Section>

            <Section title="7. Hukum yang Berlaku">
                <p>
                    Ketentuan ini tunduk pada dan ditafsirkan sesuai dengan hukum Negara Republik Indonesia, termasuk namun tidak terbatas pada
                    Undang-Undang Nomor 25 Tahun 2009 tentang Pelayanan Publik.
                </p>
            </Section>
        </StaticShell>
    );
}
