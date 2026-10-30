import { Head } from '@inertiajs/react';
import StaticShell, { Section } from './static-shell';

export default function KebijakanPrivasi() {
    return (
        <StaticShell
            title="Kebijakan Privasi"
            subtitle="Bagaimana Contact Center mengumpulkan, menggunakan, dan melindungi data Anda"
            updated="Januari 2026"
        >
            <Head title="Kebijakan Privasi — Contact Center" />

            <Section title="1. Dasar Hukum">
                <p>
                    Kebijakan ini disusun berdasarkan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi dan PermenPAN-RB Nomor 62
                    Tahun 2018 tentang Pedoman Sistem Pengaduan Pelayanan Publik Nasional.
                </p>
            </Section>

            <Section title="2. Data yang Kami Kumpulkan">
                <ul className="list-inside list-disc space-y-1 text-sm">
                    <li>Data identitas: nama, NIK, nomor telepon, dan alamat email;</li>
                    <li>Data laporan: isi aduan, lokasi kejadian, kategori, dan lampiran foto/dokumen;</li>
                    <li>
                        Data teknis: preferensi tampilan (mode gelap, ukuran font) yang disimpan secara lokal di peramban Anda dan tidak dikirim ke
                        server.
                    </li>
                </ul>
            </Section>

            <Section title="3. Tujuan Penggunaan Data">
                <p>
                    Data digunakan semata-mata untuk memverifikasi, menindaklanjuti, dan memberi notifikasi status atas laporan Anda, serta untuk
                    keperluan statistik layanan publik dalam bentuk teragregasi dan anonim.
                </p>
            </Section>

            <Section title="4. Klasifikasi Privasi Laporan">
                <p>
                    Anda dapat memilih laporan <strong>Publik (Anonim)</strong> — identitas pelapor disembunyikan otomatis namun progres tetap terbuka
                    untuk transparansi publik — atau <strong>Privat (Rahasia)</strong>, di mana seluruh identitas dan isi laporan hanya dapat diakses
                    oleh Agen Verifikator yang memegang kasus tersebut.
                </p>
            </Section>

            <Section title="5. Berbagi Data dengan Pihak Ketiga">
                <p>
                    Data pribadi Anda tidak diperjualbelikan. Data hanya dibagikan kepada unit internal Kementerian Transmigrasi atau instansi
                    pemerintah lain yang berwenang menindaklanjuti laporan, sebatas yang diperlukan.
                </p>
            </Section>

            <Section title="6. Penyimpanan & Keamanan Data">
                <p>
                    Data disimpan pada sistem yang dilengkapi kontrol akses berjenjang sesuai peran (Agen Frontdesk, Admin Kawasan, Super Admin) dan
                    disimpan selama diperlukan untuk keperluan layanan dan kepatuhan arsip pemerintah.
                </p>
            </Section>

            <Section title="7. Hak Anda atas Data Pribadi">
                <p>
                    Sesuai UU PDP, Anda berhak mengakses, memperbarui, membatasi pemrosesan, atau mengajukan keberatan atas data pribadi Anda dengan
                    menghubungi kami melalui kanal resmi pada halaman Tentang Kami.
                </p>
            </Section>
        </StaticShell>
    );
}
