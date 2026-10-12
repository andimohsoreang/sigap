import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileImage,
    FilePen,
    Gauge,
    Inbox,
    LayoutDashboard,
    Lightbulb,
    MapPin,
    MessageSquare,
    Radio,
    Search,
    Settings,
    ShieldCheck,
    Star,
    Ticket,
    UserRound,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import PublicLayout from '@/layouts/public-layout';
import { cn } from '@/lib/utils';

/**
 * Halaman panduan lengkap SIGAP per-fitur: seluruh fitur untuk masyarakat
 * (beranda, katalog, peta, formulir + unggah bukti, lacak, survei, portal
 * warga, live chat) dan seluruh fitur admin (matriks, manajemen tiket,
 * tanggapan, status, tiket internal, input manual, chat, kawasan, kanal,
 * petugas, log, pengaturan). Setiap fitur dilengkapi tangkapan layar asli
 * aplikasi yang bisa diklik untuk diperbesar (lightbox + navigasi).
 */

interface Shot {
    src: string;
    alt: string;
    caption: string;
}

interface Feature {
    id: string;
    icon: typeof Ticket;
    title: string;
    desc: ReactNode;
    tips?: string[];
    shots: Shot[];
}

const IMG = '/images/panduan';
const s = (file: string, alt: string, caption: string): Shot => ({ src: `${IMG}/${file}`, alt, caption });

const FITUR_WARGA: Feature[] = [
    {
        id: 'w-beranda',
        icon: LayoutDashboard,
        title: 'Beranda & Informasi Publik',
        desc: (
            <>
                Halaman awal SIGAP menampilkan statistik pengaduan, kanal layanan, dan pertanyaan umum. Dari beranda Anda bisa langsung menuju{' '}
                <strong>Katalog Pengaduan</strong>, <strong>Peta Kawasan</strong>, <strong>Lacak Tiket</strong>, atau membuat laporan baru lewat
                tombol aksi utama.
            </>
        ),
        tips: [
            'Menu navigasi tersedia di bagian atas; versi mobile memakai menu hamburger.',
            'Panduan ini juga terhubung dari menu navigasi & footer.',
        ],
        shots: [s('m01-beranda.jpeg', 'Beranda SIGAP', 'Beranda SIGAP: statistik, kanal layanan, dan akses cepat pembuatan laporan.')],
    },
    {
        id: 'w-katalog',
        icon: Inbox,
        title: 'Katalog Pengaduan',
        desc: (
            <>
                Daftar seluruh kanal & kategori layanan pengaduan beserta kawasan cakupan. Gunakan katalog untuk mengetahui instansi mana yang
                menangani jenis aduan Anda sebelum membuat tiket.
            </>
        ),
        shots: [s('m15-katalog.jpeg', 'Katalog pengaduan', 'Katalog pengaduan: daftar kanal, kategori, dan kawasan layanan.')],
    },
    {
        id: 'w-peta',
        icon: MapPin,
        title: 'Peta Kawasan',
        desc: (
            <>
                Peta interaktif sebaran kawasan transmigrasi dan titik pengaduan. Klik penanda pada peta untuk melihat ringkasan laporan per kawasan —
                berguna memastikan wilayah Anda sudah tercakup layanan.
            </>
        ),
        shots: [s('m16-peta.jpeg', 'Peta kawasan', 'Peta kawasan: sebaran wilayah dan titik pengaduan.')],
    },
    {
        id: 'w-formulir',
        icon: FilePen,
        title: 'Formulir Pengaduan & Unggah Bukti',
        desc: (
            <>
                Inti layanan SIGAP: formulir pengaduan yang dapat diisi <strong>tanpa login</strong>. Alurnya terdiri dari empat bagian — Data
                Pelapor, Detail Laporan, Privasi & Lampiran, lalu Pernyataan & Kirim. Ikuti urutan gambar berikut dari awal sampai selesai.
            </>
        ),
        tips: [
            'NIK wajib 16 digit; email & telepon opsional namun disarankan.',
            'Uraian minimal 10 karakter — semakin rinci semakin cepat ditindaklanjuti.',
            'Tombol GPS mengisi koordinat otomatis dari perangkat Anda.',
            'Lampiran: JPG, PNG, atau PDF maksimal 5 MB.',
        ],
        shots: [
            s('m02-form-kosong.jpeg', 'Formulir pengaduan kosong', 'Langkah 1 — Formulir dalam keadaan kosong, siap diisi.'),
            s('m03-data-pelapor.jpeg', 'Bagian data pelapor terisi', 'Langkah 2 — Isi NIK, nama lengkap, email, dan nomor telepon/WA.'),
            s('m04-detail-laporan.jpeg', 'Bagian detail laporan', 'Langkah 3 — Judul, uraian, dan titik koordinat (manual atau tombol GPS).'),
            s('m05-pilih-kawasan.jpeg', 'Dropdown pilihan kawasan', 'Langkah 4 — Pilih Lokasi Kawasan melalui dropdown bertingkat.'),
            s('m04b-detail-terisi.jpeg', 'Detail laporan terisi lengkap', 'Langkah 5 — Kawasan, kategori, dan tingkat dampak sudah terpilih.'),
            s(
                'm06-privasi-lampiran.jpeg',
                'Privasi dan lampiran terunggah',
                'Langkah 6 — Pilih privasi (Publik/Anonim/Rahasia) lalu unggah berkas bukti.',
            ),
            s('m07-kirim.jpeg', 'Pernyataan dan tombol kirim', 'Langkah 7 — Centang pernyataan kebenaran data, tombol Kirim Pengaduan aktif.'),
        ],
    },
    {
        id: 'w-lacak',
        icon: Search,
        title: 'Nomor Tiket & Lacak Status',
        desc: (
            <>
                Setelah terkirim Anda mendapat <strong>nomor tiket</strong> (format <code>TKT-YYMMDD-XXXXXX</code>, contoh: TKT-261012-7KQ4MZ; nomor
                lama seperti TKT-15 tetap berlaku) dan diarahkan ke halaman lacak. Masukkan nomor itu kapan saja untuk melihat status terkini, detail
                laporan, lampiran, serta <strong>riwayat penanganan</strong> dan tanggapan petugas.
            </>
        ),
        tips: ['Simpan/screenshot nomor tiket segera setelah laporan terkirim.', 'Tanggapan berlabel publik juga muncul di riwayat ini.'],
        shots: [
            s('m08-sukses.jpeg', 'Notifikasi tiket berhasil', 'Notifikasi sukses beserta nomor tiket baru.'),
            s('m09-lacak.jpeg', 'Halaman lacak tiket', 'Halaman lacak: status, detail laporan, dan lampiran.'),
            s('m09b-riwayat.jpeg', 'Riwayat penanganan tiket', 'Riwayat penanganan: setiap perubahan status & tanggapan tercatat.'),
        ],
    },
    {
        id: 'w-survei',
        icon: Star,
        title: 'Survei Kepuasan',
        desc: (
            <>
                Bila status tiket menjadi <strong>Selesai</strong>, halaman lacak menampilkan tombol <strong>Isi Survei Kepuasan</strong>. Beri
                penilaian bintang 1–5 beserta komentar; jawaban Anda dipakai untuk mengukur mutu layanan tiap kawasan.
            </>
        ),
        shots: [s('m13-survei.jpeg', 'Dialog survei kepuasan', 'Dialog survei kepuasan dengan penilaian bintang dan kolom komentar.')],
    },
    {
        id: 'w-portal',
        icon: UserRound,
        title: 'Portal Warga (Login & Profil)',
        desc: (
            <>
                Warga terdaftar dapat masuk memakai <strong>NIK + kata sandi</strong> melalui halaman /masuk. Portal Warga menampilkan profil, data
                kontak, serta <strong>riwayat seluruh laporan</strong> yang terhubung ke akun Anda — tanpa perlu mengingat nomor tiket satu per satu.
            </>
        ),
        tips: ['Laporan yang dibuat saat login otomatis terhubung ke akun.', 'Perbarui email/telepon di profil agar mudah dihubungi petugas.'],
        shots: [
            s('m14-login.jpeg', 'Halaman masuk', 'Halaman masuk: satu formulir untuk warga (NIK) maupun petugas (username).'),
            s('m10-portal.jpeg', 'Portal warga', 'Portal Warga: kartu profil dan ringkasan laporan Anda.'),
            s('m10b-portal-riwayat.jpeg', 'Riwayat laporan warga', 'Daftar riwayat laporan beserta status terakhirnya.'),
        ],
    },
    {
        id: 'w-chat',
        icon: MessageSquare,
        title: 'Live Chat Bantuan',
        desc: (
            <>
                Widget obrolan di pojok kanan bawah menghubungkan Anda langsung dengan petugas SIGAP tanpa formulir. Cocok untuk pertanyaan cepat atau
                klarifikasi laporan yang sedang berjalan.
            </>
        ),
        tips: ['Balasan petugas masuk ke halaman Pesan Masuk panel admin.', 'Untuk laporan resmi tetap gunakan formulir pengaduan.'],
        shots: [s('m11-livechat.jpeg', 'Widget live chat', 'Widget live chat: kirim pertanyaan dan terima balasan petugas.')],
    },
];

const FITUR_ADMIN: Feature[] = [
    {
        id: 'a-matriks',
        icon: BarChart3,
        title: 'Matriks Rekapan',
        desc: (
            <>
                Dasbor utama admin: total tiket rekapan, peringatan <strong>EWS (Early Warning System)</strong> untuk tiket mendekati/lewat tenggat
                SLA, dan persentase SLA terpenuhi. Tabel rekapitulasi mendukung pencarian, filter wilayah/kategori/dampak/status, pengurutan kolom,
                pilihan kolom, serta paginasi.
            </>
        ),
        tips: ['Klik judul kolom untuk mengurutkan; klik ikon mata untuk membuka detail tiket.'],
        shots: [s('a01-matriks.jpeg', 'Matriks rekapan admin', 'Matriks rekapan: kartu indikator dan tabel rekapitulasi tiket.')],
    },
    {
        id: 'a-tiket',
        icon: Ticket,
        title: 'Manajemen Tiket: Daftar, Filter & Kolom',
        desc: (
            <>
                Halaman <strong>Manajemen Tiket</strong> memuat seluruh laporan masyarakat. Gunakan kotak pencarian, dropdown filter (wilayah,
                kategori, dampak, status), menu <strong>Kolom</strong> untuk menyembunyikan/menampilkan kolom tabel, dan pengurutan per kolom sebelum
                menindaklanjuti tiket.
            </>
        ),
        shots: [
            s('a02-tiket.jpeg', 'Daftar manajemen tiket', 'Daftar tiket lengkap dengan pencarian, filter, dan paginasi.'),
            s('a03-filter.jpeg', 'Dropdown filter status', 'Dropdown filter status pada toolbar tabel.'),
            s('a04-kolom.jpeg', 'Menu pilihan kolom', 'Menu Kolom: centang kolom yang ingin ditampilkan.'),
        ],
    },
    {
        id: 'a-detail',
        icon: ClipboardList,
        title: 'Detail Tiket & Unduh Lampiran',
        desc: (
            <>
                Halaman detail menampilkan uraian laporan, kategori, kawasan, data pelapor dengan <strong>NIK tersamar</strong>, kontak, tenggat SLA,
                serta tombol <strong>Unduh Lampiran</strong> untuk membuka berkas bukti yang diunggah pelapor.
            </>
        ),
        tips: ['NIK disamarkan otomatis demi privasi pelapor.', 'Perhatikan tenggat SLA di kartu detail sebelum menanggapi.'],
        shots: [s('a05-detail.jpeg', 'Detail tiket admin', 'Detail tiket: uraian, data pelapor tersamar, SLA, dan unduh lampiran.')],
    },
    {
        id: 'a-tanggapan',
        icon: MessageSquare,
        title: 'Memberi Tanggapan Tiket',
        desc: (
            <>
                Tulis tanggapan pada kartu <strong>Tanggapan</strong>. Centang <strong>Tampilkan ke pelapor</strong> agar pesan terlihat di halaman
                lacak pelapor; tanpa centang, tanggapan bersifat internal antar-admin. Setiap tanggapan tersimpan di riwayat tiket.
            </>
        ),
        shots: [
            s('a06-tanggapan.jpeg', 'Kolom tanggapan terisi', 'Tanggapan ditulis pada kolom yang tersedia beserta opsi publik.'),
            s('a07-tanggapan-kirim.jpeg', 'Tanggapan terkirim', 'Tanggapan tersimpan dan masuk riwayat penanganan tiket.'),
        ],
    },
    {
        id: 'a-status',
        icon: Gauge,
        title: 'Mengubah Status Tiket & SLA',
        desc: (
            <>
                Panel <strong>Ubah Status</strong> menggerakkan tiket melalui alur Menunggu → Diverifikasi → Diproses → Selesai/Ditolak. Pilih status
                baru, isi catatan (disarankan), lalu <strong>Simpan Status</strong>. Perubahan tercatat otomatis di riwayat dan memperbarui
                perhitungan SLA/EWS.
            </>
        ),
        tips: ['Status Selesai memicu permintaan survei kepuasan ke pelapor.', 'Catatan status menjadi jejak audit yang terlihat di riwayat.'],
        shots: [
            s('a08-status.jpeg', 'Dropdown pilihan status', 'Pilihan status baru pada panel Ubah Status.'),
            s('a09-status-form.jpeg', 'Form status dengan catatan', 'Status terpilih beserta catatan penanganan.'),
            s('a10-status-baru.jpeg', 'Status tersimpan', 'Status baru tersimpan; badge dan riwayat diperbarui.'),
        ],
    },
    {
        id: 'a-internal',
        icon: FilePen,
        title: 'Tiket Internal',
        desc: (
            <>
                Daftar laporan yang dibuat sesama petugas (internal), terpisah dari aduan masyarakat. Penanganannya sama: buka detail, tanggapi, dan
                perbarui status melalui halaman detail tiket.
            </>
        ),
        shots: [s('a11-internal.jpeg', 'Daftar tiket internal', 'Daftar tiket internal antar-petugas.')],
    },
    {
        id: 'a-manual',
        icon: Zap,
        title: 'Input Manual (Media Sosial & Offline)',
        desc: (
            <>
                Catat keluhan warga yang masuk lewat kanal non-formulir (DM Instagram, telepon, surat, tatap muka) agar tetap masuk rekapitulasi. Isi
                sumber, identitas pelapor/username, judul, uraian, tautan bukti, kawasan, kategori, dan dampak — tiket terbentuk otomatis.
            </>
        ),
        tips: ['Cantumkan tautan bukti (URL postingan) bila ada agar mudah diverifikasi.'],
        shots: [s('a12-input-manual.jpeg', 'Form input manual terisi', 'Form input manual terisi untuk aduan via media sosial.')],
    },
    {
        id: 'a-chat',
        icon: Inbox,
        title: 'Pesan Masuk (Live Chat)',
        desc: (
            <>
                Seluruh percakapan live chat warga terkumpul di sini. Pilih percakapan pada daftar kiri, baca riwayatnya, lalu balas melalui kolom di
                bawah. Balasan langsung terkirim ke widget chat pelapor.
            </>
        ),
        shots: [
            s('a13-chat.jpeg', 'Halaman pesan masuk', 'Pesan masuk: daftar percakapan dan balasan yang sedang ditulis.'),
            s('a14-chat-balasan.jpeg', 'Balasan terkirim', 'Balasan admin terkirim dan tampil di riwayat percakapan.'),
        ],
    },
    {
        id: 'a-kawasan',
        icon: MapPin,
        title: 'Data Kawasan',
        desc: (
            <>
                Kelola master kawasan transmigrasi: kode, nama, provinsi, status aktif, serta titik koordinat pusat kawasan yang dipakai peta publik
                dan dropdown formulir. Tambah/ubah kawasan lewat formulir pada halaman yang sama.
            </>
        ),
        shots: [s('a15-kawasan.jpeg', 'Manajemen data kawasan', 'Manajemen data kawasan beserta formulir tambah/ubah.')],
    },
    {
        id: 'a-kanal',
        icon: Radio,
        title: 'Manajemen Kanal',
        desc: (
            <>
                Daftarkan kanal pengaduan resmi (instansi, platform media sosial, penanggung jawab, tautan) berikut tombol sinkronisasi integrasi.
                Kanal inilah yang tampil pada Katalog Pengaduan di sisi publik.
            </>
        ),
        shots: [s('a16-kanal.jpeg', 'Manajemen kanal', 'Manajemen kanal: daftar kanal resmi dan formulir pendaftaran.')],
    },
    {
        id: 'a-petugas',
        icon: Users,
        title: 'Daftar Admin / Petugas',
        desc: (
            <>
                Khusus super admin: kelola akun petugas (nama, NIP, username, peran, kawasan tugas). Tambahkan petugas baru atau ubah peran agar hak
                akses panel sesuai struktur organisasi.
            </>
        ),
        tips: ['Peran admin_kawasan hanya melihat tiket kawasan tugasnya.'],
        shots: [s('a17-petugas.jpeg', 'Daftar admin', 'Daftar admin/petugas beserta peran dan kawasan tugas.')],
    },
    {
        id: 'a-log',
        icon: Activity,
        title: 'Log Aktivitas',
        desc: (
            <>
                Rekaman jejak audit seluruh aksi penting di panel (login, perubahan status, tanggapan, perubahan master data) lengkap dengan pelaku
                dan waktunya — dasar penelusuran bila terjadi sengketa penanganan.
            </>
        ),
        shots: [s('a18-log.jpeg', 'Log aktivitas', 'Log aktivitas: jejak audit aksi petugas beserta waktunya.')],
    },
    {
        id: 'a-pengaturan',
        icon: Settings,
        title: 'Pengaturan Sistem',
        desc: (
            <>
                Atur identitas layanan (kontak resmi, email dukungan), kategori pengaduan, serta parameter sistem lain yang dipakai formulir publik
                dan notifikasi. Perubahan langsung berlaku bagi seluruh pengguna.
            </>
        ),
        shots: [s('a19-pengaturan.jpeg', 'Halaman pengaturan', 'Pengaturan sistem: kontak layanan dan master kategori.')],
    },
];

const ALUR_SINGKAT = [
    { icon: FilePen, label: 'Isi formulir', desc: 'Data pelapor + detail laporan' },
    { icon: FileImage, label: 'Unggah bukti', desc: 'JPG/PNG/PDF maks. 5 MB' },
    { icon: Zap, label: 'Tiket terbit', desc: 'Nomor TKT-YYMMDD-XXXXXX tersimpan' },
    { icon: ShieldCheck, label: 'Verifikasi admin', desc: 'Status & tanggapan diperbarui' },
    { icon: Search, label: 'Lacak & survei', desc: 'Pelapor memantau + menilai' },
];

export default function Panduan() {
    const [tab, setTab] = useState<'warga' | 'admin'>('warga');
    const [lightbox, setLightbox] = useState<{ shots: Shot[]; index: number } | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightbox(null);
            if (lightbox) {
                if (e.key === 'ArrowRight') setLightbox((l) => l && { ...l, index: (l.index + 1) % l.shots.length });
                if (e.key === 'ArrowLeft') setLightbox((l) => l && { ...l, index: (l.index - 1 + l.shots.length) % l.shots.length });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightbox]);

    const fitur = tab === 'warga' ? FITUR_WARGA : FITUR_ADMIN;
    const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return (
        <PublicLayout title="Panduan">
            <Head title="Panduan Lengkap — SIGAP">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,700|jost:300,400,500,600,700"
                    head-key="absol-fonts"
                />
            </Head>

            <div className="font-body">
                {/* HERO */}
                <section className="bg-brand relative overflow-hidden pt-14 pb-16 lg:pt-16 lg:pb-20">
                    <div className="from-brand via-brand to-brand-light absolute inset-0 bg-gradient-to-br" />
                    <div
                        className="absol-grid-pan absolute inset-0 opacity-10"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
                            backgroundSize: '56px 56px',
                        }}
                    />
                    <div className="absol-orb absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

                    <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
                        <span className="text-secondary mb-4 inline-flex items-center gap-3 text-xs font-bold tracking-[3px] uppercase">
                            <span className="bg-secondary hidden h-[2px] w-6 sm:block" />
                            Pusat Bantuan
                            <span className="bg-secondary hidden h-[2px] w-6 sm:block" />
                        </span>
                        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-white uppercase md:text-5xl">
                            Panduan Lengkap SIGAP
                        </h1>
                        <div className="bg-secondary mx-auto mt-5 h-[3px] w-20 rounded-full" />
                        <p className="mx-auto mt-6 max-w-2xl text-white/85 md:text-lg">
                            Dokumentasi visual seluruh fitur — untuk masyarakat maupun admin — langkah demi langkah dengan tangkapan layar asli
                            aplikasi. Klik gambar untuk memperbesar, gunakan tombol panah untuk berpindah.
                        </p>

                        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {ALUR_SINGKAT.map(({ icon: Icon, label, desc }, i) => (
                                <div
                                    key={label}
                                    className="rounded-xl border border-white/20 bg-white/10 p-4 text-left backdrop-blur-md transition hover:bg-white/15"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="bg-secondary text-brand flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <Icon className="h-4 w-4 text-white" />
                                    </div>
                                    <p className="font-heading text-sm font-bold text-white uppercase">{label}</p>
                                    <p className="mt-0.5 text-xs text-white/70">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
                    {/* TAB */}
                    <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
                        {(
                            [
                                ['warga', 'Fitur Masyarakat', Users],
                                ['admin', 'Fitur Admin', ShieldCheck],
                            ] as const
                        ).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={cn(
                                    'font-heading flex items-center gap-2 rounded-full border-2 px-6 py-3 text-sm font-bold tracking-wide uppercase transition',
                                    tab === key
                                        ? 'border-brand bg-brand text-white shadow-lg'
                                        : 'border-brand-light/40 text-brand hover:border-brand-light hover:bg-brand-light/10 dark:text-brand-light',
                                )}
                            >
                                <Icon className="h-4 w-4" /> {label}
                            </button>
                        ))}
                    </div>

                    {/* INDEKS FITUR */}
                    <div className="dark:bg-dark-card mb-12 rounded-xl border border-gray-100 bg-white p-6 shadow-md dark:border-gray-800">
                        <h2 className="font-heading text-brand mb-4 flex items-center gap-2 text-sm font-bold tracking-[2px] uppercase dark:text-white">
                            <BookOpen className="text-brand-light h-4 w-4" /> Daftar Fitur — {tab === 'warga' ? 'Masyarakat' : 'Admin'}
                        </h2>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {fitur.map((f, i) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => jump(f.id)}
                                    className="group border-brand-light/30 hover:border-brand-light hover:bg-brand-light/10 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition dark:border-gray-700 dark:hover:border-gray-500"
                                >
                                    <span className="bg-brand-light/15 text-brand-light group-hover:bg-brand-light flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition group-hover:text-white">
                                        {i + 1}
                                    </span>
                                    <span className="group-hover:text-brand truncate font-medium text-gray-700 dark:text-gray-200">{f.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION PER FITUR */}
                    <div className="space-y-14">
                        {fitur.map((f, i) => (
                            <article key={f.id} id={f.id} className="scroll-mt-24">
                                <div className="mb-4 flex items-start gap-4">
                                    <span className="font-heading bg-brand-light flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-md">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="font-heading text-brand flex flex-wrap items-center gap-2 text-xl leading-tight font-bold tracking-tight uppercase md:text-2xl dark:text-white">
                                            <f.icon className="text-brand-light h-6 w-6 shrink-0" />
                                            {f.title}
                                        </h2>
                                        <div className="bg-brand-light mt-2 h-[3px] w-14 rounded-full" />
                                    </div>
                                </div>
                                <p className="mb-4 leading-relaxed text-gray-600 md:ml-16 dark:text-gray-300">{f.desc}</p>
                                {f.tips && (
                                    <ul className="mb-5 space-y-2 md:ml-16">
                                        {f.tips.map((t) => (
                                            <li key={t} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <CheckCircle2 className="text-brand-light mt-0.5 h-4 w-4 shrink-0" />
                                                {t}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className={cn('grid gap-5', f.shots.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1')}>
                                    {f.shots.map((shot, si) => (
                                        <figure key={shot.src} className={cn(f.shots.length === 1 && 'mx-auto w-full max-w-4xl')}>
                                            <button
                                                type="button"
                                                onClick={() => setLightbox({ shots: f.shots, index: si })}
                                                className="group block w-full cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
                                                aria-label={`Perbesar gambar: ${shot.caption}`}
                                            >
                                                <img src={shot.src} alt={shot.alt} loading="lazy" className="w-full" />
                                            </button>
                                            <figcaption className="mt-2 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <FileImage className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                {shot.caption}
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>

                    {/* KETENTUAN LAMPIRAN */}
                    <div className="dark:bg-dark-card mt-14 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md dark:border-gray-800">
                        <div className="bg-brand-light/5 border-brand-light flex flex-col items-start gap-4 border-l-4 p-6 md:flex-row md:items-center dark:bg-gray-800">
                            <div className="bg-brand-light/10 text-brand-light flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
                                <Lightbulb className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-heading text-brand mb-1 font-bold tracking-tight uppercase dark:text-white">
                                    Ketentuan Lampiran & Data
                                </h3>
                                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                    Lampiran bukti menerima berkas <strong>JPG, PNG, atau PDF</strong> dengan ukuran maksimal <strong>5 MB</strong>.
                                    Uraian laporan minimal 10 karakter dan NIK pelapor wajib 16 digit. Dokumen yang sudah diunggah{' '}
                                    <strong>tidak dapat dihapus mandiri</strong> demi akuntabilitas — hubungi admin melalui Live Chat bila perlu
                                    perbaikan.
                                </p>
                            </div>
                            <Button asChild className="font-heading shrink-0 rounded-full font-bold tracking-wide uppercase md:ml-auto">
                                <Link href="/pengaduan/baru">
                                    <FilePen className="h-4 w-4" /> Mulai Pengaduan
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* BANTUAN LANJUTAN */}
                    <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[
                            { icon: BookOpen, title: 'Pedoman Layanan', desc: 'Standar pelayanan & maklumat resmi SIGAP.', href: '/pedoman-layanan' },
                            { icon: Search, title: 'Lacak Tiket', desc: 'Pantau status laporan Anda kapan saja.', href: '/lacak' },
                            { icon: Inbox, title: 'Katalog Pengaduan', desc: 'Daftar kanal & kategori layanan pengaduan.', href: '/katalog' },
                        ].map(({ icon: Icon, title, desc, href }) => (
                            <Link
                                key={href}
                                href={href}
                                className="group dark:bg-dark-card rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800"
                            >
                                <div className="bg-brand-light/10 text-brand-light group-hover:bg-brand-light mb-4 flex h-12 w-12 items-center justify-center rounded-full transition group-hover:text-white">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <h3 className="font-heading text-brand font-bold tracking-tight uppercase dark:text-white">{title}</h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>

            {/* LIGHTBOX */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightbox.shots[lightbox.index].caption}
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative flex max-h-full w-full max-w-5xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={lightbox.shots[lightbox.index].src}
                            alt={lightbox.shots[lightbox.index].alt}
                            className="max-h-[80vh] w-auto rounded-lg shadow-2xl"
                        />
                        <p className="mt-3 text-center text-sm text-white/90">
                            {lightbox.shots[lightbox.index].caption}
                            {lightbox.shots.length > 1 && (
                                <span className="ml-2 text-white/60">
                                    ({lightbox.index + 1}/{lightbox.shots.length})
                                </span>
                            )}
                        </p>

                        {lightbox.shots.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setLightbox((l) => l && { ...l, index: (l.index - 1 + l.shots.length) % l.shots.length })}
                                    className="absolute top-1/2 -left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg transition hover:bg-white md:-left-14"
                                    aria-label="Gambar sebelumnya"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLightbox((l) => l && { ...l, index: (l.index + 1) % l.shots.length })}
                                    className="absolute top-1/2 -right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg transition hover:bg-white md:-right-14"
                                    aria-label="Gambar berikutnya"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => setLightbox(null)}
                            className="absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition hover:bg-gray-200 md:-top-4 md:-right-4"
                            aria-label="Tutup gambar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </PublicLayout>
    );
}
