import { Link } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    BookOpen,
    Building2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileImage,
    FilePen,
    Globe,
    Inbox,
    LayoutDashboard,
    Library,
    Lightbulb,
    LogIn,
    Map,
    MapPin,
    MessageSquare,
    MessagesSquare,
    Network,
    Radio,
    ScrollText,
    Search,
    Settings,
    ShieldCheck,
    Star,
    Ticket,
    UserRound,
    Users,
    Waypoints,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import TaraPage from '@/components/sigap/tara-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Panduan lengkap Contact Center per fitur, untuk masyarakat dan petugas.
 * Tangkapan layar di public/images/panduan dibuat ulang dari aplikasi oleh
 * `npx playwright test -c playwright.panduan.config.ts` (tests/panduan) dengan
 * data contoh; nama berkas di sini harus sama dengan di spesifikasi itu.
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
const s = (file: string, alt: string, caption: string): Shot => ({ src: `${IMG}/${file}.jpg`, alt, caption });

const FITUR_WARGA: Feature[] = [
    {
        id: 'w-beranda',
        icon: LayoutDashboard,
        title: 'Beranda',
        desc: (
            <>
                Halaman awal Contact Center. Dari sini Anda bisa <strong>mulai chat dengan TARA</strong>, melacak tiket, atau membuka menu{' '}
                <strong>Katalog Pengaduan</strong>, <strong>Peta Wilayah</strong>, <strong>Data</strong>, dan <strong>Panduan</strong> di bagian atas.
                Tombol TARA di pojok kanan bawah selalu tersedia di setiap halaman.
            </>
        ),
        tips: [
            'Tombol bulan di menu atas mengganti tampilan terang/gelap.',
            'Tombol aksesibilitas di sisi kiri mengatur ukuran huruf, kontras, dan huruf ramah disleksia.',
        ],
        shots: [s('w01-beranda', 'Beranda Contact Center', 'Beranda: mulai chat dengan TARA atau lacak tiket langsung dari halaman awal.')],
    },
    {
        id: 'w-chat',
        icon: MessageSquare,
        title: 'Chat TARA',
        desc: (
            <>
                TARA adalah asisten Contact Center yang menjawab dari <strong>sumber resmi</strong> Kementerian Transmigrasi dan meneruskan Anda ke
                petugas bila perlu. Isi <strong>nama</strong> dan <strong>provinsi asal</strong>, lalu tulis pertanyaan atau pilih topik seperti{' '}
                <em>Lapor masalah</em> atau <em>Cek status tiket</em>. Bila urusan Anda perlu ditindaklanjuti, nomor tiketnya muncul di panel kanan.
            </>
        ),
        tips: [
            'Jangan tulis NIK, nomor rekening, atau alamat lengkap di chat.',
            'Petugas melayani Senin–Jumat 08.00–16.00 WIB; TARA aktif 24 jam.',
            'Tombol Transkrip menyimpan salinan percakapan.',
        ],
        shots: [s('w02-chat-tara', 'Chat TARA', 'Chat TARA: kenalan singkat, lalu tanya atau lapor dalam satu percakapan.')],
    },
    {
        id: 'w-formulir',
        icon: FilePen,
        title: 'Formulir Pengaduan',
        desc: (
            <>
                Formulir pengaduan bisa diisi <strong>tanpa masuk akun</strong>. Isiannya terbagi empat kartu: <strong>Data pelapor</strong>,{' '}
                <strong>Isi laporan</strong>, <strong>Lokasi kejadian</strong>, serta <strong>Privasi & bukti</strong>, lalu centang pernyataan dan
                kirim. Ikuti urutan gambar berikut.
            </>
        ),
        tips: [
            'NIK wajib 16 digit dan tidak pernah ditampilkan ke publik.',
            'Uraian minimal 10 karakter. Tingkat dampak menentukan tenggat penanganan.',
            'Provinsi wajib; tombol "Pakai lokasi saya" mengisi titik koordinat dari perangkat.',
            'Privasi: Publik, Anonim (nama disembunyikan), atau Rahasia (identitas dan laporan tidak tampil ke publik).',
            'Lampiran bukti: JPG, PNG, atau PDF maksimal 5 MB.',
        ],
        shots: [
            s('w03-form', 'Halaman formulir pengaduan', 'Halaman formulir pengaduan masyarakat.'),
            s('w04-form-pelapor', 'Kartu data pelapor terisi', 'Langkah 1 — Data pelapor: NIK, nama lengkap, email, dan nomor telepon/WA.'),
            s('w05-form-laporan', 'Kartu isi laporan terisi', 'Langkah 2 — Isi laporan: judul, uraian, kategori, dan tingkat dampak.'),
            s('w06-form-lokasi', 'Kartu lokasi kejadian terisi', 'Langkah 3 — Lokasi kejadian: provinsi, kabupaten/kawasan/desa, dan koordinat.'),
            s('w07-form-privasi', 'Kartu privasi dan bukti terisi', 'Langkah 4 — Pilih privasi laporan dan lampirkan bukti.'),
            s('w08-form-kirim', 'Pernyataan dan tombol kirim', 'Langkah 5 — Centang pernyataan, lalu tekan Kirim Pengaduan.'),
        ],
    },
    {
        id: 'w-lacak',
        icon: Search,
        title: 'Nomor Tiket & Lacak Status',
        desc: (
            <>
                Setelah terkirim, Anda langsung mendapat <strong>nomor tiket</strong> (format <code>TKT-YYMMDD-XXXXXX</code>) dan dibawa ke halaman{' '}
                <strong>Lacak Tiket</strong>. Masukkan nomor itu kapan saja untuk melihat tahapan penanganan (Menunggu → Diverifikasi → Diproses →
                Selesai), detail laporan, dan <strong>Riwayat Penanganan</strong> beserta tanggapan petugas.
            </>
        ),
        tips: [
            'Simpan nomor tiket segera setelah laporan terkirim.',
            'Nomor format lama memerlukan kode akses 8 karakter yang dulu dikirimkan bersama nomornya.',
            'Nama pelapor di halaman lacak selalu disamarkan.',
        ],
        shots: [
            s('w09-tiket-terbit', 'Tiket baru terbit', 'Tiket terbit: nomor tiket muncul dan status awal Menunggu.'),
            s('w10-lacak', 'Halaman lacak tiket', 'Halaman Lacak Tiket: masukkan nomor tiket lalu tekan Cari.'),
            s('w11-lacak-detail', 'Detail tiket di halaman lacak', 'Tahapan penanganan dan Riwayat Penanganan sebuah tiket.'),
            s('w12-lacak-riwayat', 'Tanggapan dan riwayat tiket selesai', 'Detail laporan dan tanggapan petugas pada tiket yang sudah selesai.'),
        ],
    },
    {
        id: 'w-survei',
        icon: Star,
        title: 'Survei Kepuasan',
        desc: (
            <>
                Bila tiket <strong>Selesai</strong>, halaman lacak menampilkan tombol <strong>Isi Survei Kepuasan</strong>. Beri nilai 1–5 bintang dan
                komentar bila mau. Penilaian Anda dipakai untuk mengukur mutu layanan Contact Center.
            </>
        ),
        shots: [s('w13-survei', 'Dialog survei kepuasan', 'Survei kepuasan: pilih bintang, tulis komentar, lalu Kirim Penilaian.')],
    },
    {
        id: 'w-akun',
        icon: LogIn,
        title: 'Masuk & Daftar Akun Warga',
        desc: (
            <>
                Akun tidak wajib, tetapi memudahkan: semua pengaduan Anda tersimpan di satu tempat. Daftar di halaman{' '}
                <strong>Daftar Akun Warga</strong> dengan NIK, nama, email, dan kata sandi, lalu buka tautan verifikasi di email. Setelah itu masuk
                lewat halaman <strong>Masuk</strong> memakai NIK dan kata sandi. Petugas dan admin memakai halaman yang sama dengan username.
            </>
        ),
        tips: ['Lupa kata sandi? Klik "Lupa kata sandi?" untuk menerima tautan atur ulang lewat email.'],
        shots: [
            s('w14-masuk', 'Halaman masuk', 'Masuk: NIK untuk warga, username untuk petugas dan admin.'),
            s('w19-daftar', 'Halaman daftar akun warga', 'Daftar Akun Warga: isi data, setujui ketentuan, lalu verifikasi email.'),
        ],
    },
    {
        id: 'w-portal',
        icon: UserRound,
        title: 'Portal Warga',
        desc: (
            <>
                Setelah masuk, <strong>Portal Warga</strong> menampilkan <strong>Riwayat Tiket Pengaduan</strong> Anda lengkap dengan status, kode
                akses, dan unduhan lampiran, serta <strong>Pengaturan Akun</strong> untuk mengubah email, nomor telepon, dan kata sandi. Tombol{' '}
                <strong>Buat pengaduan</strong> membuka formulir dengan data Anda.
            </>
        ),
        tips: ['Tiket yang masih berstatus Menunggu dapat Anda hapus sendiri dari portal.', 'NIK tidak dapat diubah dari portal.'],
        shots: [s('w15-portal-warga', 'Portal warga', 'Portal Warga: pengaturan akun dan riwayat tiket pengaduan.')],
    },
    {
        id: 'w-katalog',
        icon: Inbox,
        title: 'Katalog Pengaduan',
        desc: (
            <>
                Kumpulan kanal resmi Kementerian Transmigrasi: media sosial, email, hotline WhatsApp, kanal nasional seperti SP4N-LAPOR!, kanal aduan
                pegawai, serta daftar <strong>Kantor Pusat dan Balai</strong> beserta kontaknya. Gunakan bila Anda ingin melapor lewat kanal lain atau
                datang langsung.
            </>
        ),
        shots: [s('w16-katalog', 'Katalog pengaduan', 'Katalog Pengaduan: kanal resmi serta kantor dan balai transmigrasi.')],
    },
    {
        id: 'w-peta-data',
        icon: MapPin,
        title: 'Peta Wilayah & Data Terbuka',
        desc: (
            <>
                <strong>Peta Wilayah</strong> menampilkan sebaran pengaduan per provinsi asal; klik provinsi untuk melihat rinciannya.{' '}
                <strong>Data</strong> menyajikan angka layanan yang diperbarui otomatis (laporan masuk hari ini, sedang diproses, selesai, dan total)
                tanpa data pribadi pelapor.
            </>
        ),
        shots: [
            s('w17-peta', 'Peta sebaran pengaduan', 'Peta Wilayah: sebaran pengaduan per provinsi asal.'),
            s('w18-data', 'Data terbuka Contact Center', 'Data Terbuka: angka layanan pengaduan yang diperbarui otomatis.'),
        ],
    },
];

const FITUR_ADMIN: Feature[] = [
    {
        id: 'a-matriks',
        icon: BarChart3,
        title: 'Matriks Rekapan',
        desc: (
            <>
                Dasbor utama petugas. Bagian atas menunjukkan <strong>alur penanganan</strong> dari pintu masuk (formulir web, input manual, Chat
                TARA) sampai Selesai/Ditolak, disusul indikator tiket berjalan, <strong>peringatan EWS</strong>, SLA terpenuhi, dan rata-rata waktu
                respons serta penyelesaian. Di bawahnya ada peta sebaran, tren harian, komposisi status/kategori/kanal/dampak, kepatuhan SLA dan
                kepuasan, <strong>corong layanan TARA</strong>, <strong>kinerja petugas</strong>, dan matriks kategori × tahap penanganan.
            </>
        ),
        tips: [
            'Saring per bulan dan provinsi di kanan atas; tombol Print mencetak rekap.',
            'Klik tahap pada alur penanganan atau provinsi pada peta untuk menyaring tabel di bawahnya.',
            'Matriks kategori dapat ditampilkan sebagai tabel atau grafik, per kategori, provinsi, kanal, atau petugas.',
        ],
        shots: [
            s('a01-matriks', 'Matriks rekapan', 'Alur penanganan bulan ini dan indikator utama.'),
            s('a02-matriks-peta', 'Peta sebaran di matriks', 'Peta sebaran pengaduan per wilayah.'),
            s('a03-matriks-layanan', 'Corong layanan TARA dan kinerja petugas', 'Corong layanan TARA dan tiket per petugas.'),
            s('a04-matriks-grafik', 'Grafik kategori dan target SLA', 'Kategori × tahap penanganan, target SLA, dan ketepatan waktu per dampak.'),
        ],
    },
    {
        id: 'a-tiket',
        icon: Ticket,
        title: 'Manajemen Tiket',
        desc: (
            <>
                Semua pengaduan dari seluruh kanal. Tab di atas membantu memilah: <strong>Aktif</strong>, <strong>Lewat SLA</strong>,{' '}
                <strong>Belum didisposisi</strong> (khusus Super Admin), <strong>Belum ditugaskan</strong>, <strong>Selesai</strong>, dan{' '}
                <strong>Semua</strong>. Cari nomor atau judul, saring dampak dan provinsi, atur kolom, lalu klik baris untuk membuka detail.
            </>
        ),
        tips: ['Mulai dari tab Lewat SLA dan Belum ditugaskan.', 'Baris berlatar merah menandai tiket yang melewati tenggat SLA.'],
        shots: [
            s('a05-tiket', 'Daftar manajemen tiket', 'Daftar tiket dengan tab, pencarian, saringan, dan tenggat SLA.'),
            s('a06-tiket-belum-disposisi', 'Tab belum didisposisi', 'Tab Belum didisposisi: tiket aktif yang belum diteruskan ke unit kerja.'),
        ],
    },
    {
        id: 'a-detail',
        icon: ClipboardList,
        title: 'Detail Tiket: Disposisi, Tanggapan & Status',
        desc: (
            <>
                Halaman detail merangkum status, dampak, tenggat SLA, dan petugas, lalu uraian laporan, data pelapor, dan riwayat status. Tiga panel
                dipakai untuk menindaklanjuti:
                <br />• <strong>Disposisi unit</strong>: Super Admin meneruskan tiket ke Unit Kerja yang berwenang, lalu dapat{' '}
                <strong>Alihkan</strong> ke unit lain atau <strong>Tarik</strong> kembali.
                <br />• <strong>Tanggapan</strong>: pilih <strong>Balas ke pelapor</strong> (tampil di halaman lacak dan dikirim lewat email bila ada)
                atau <strong>Catatan internal</strong> untuk sesama petugas.
                <br />• <strong>Tindak lanjut</strong>: pilih status baru (Diverifikasi, Diproses, Selesai, atau Ditolak), isi catatan, lalu{' '}
                <strong>Simpan Status</strong>.
            </>
        ),
        tips: [
            'Petugas unit hanya melihat tiket yang didisposisikan ke unitnya.',
            'Status Selesai membuka survei kepuasan bagi pelapor.',
            'Setiap perubahan tercatat di riwayat status dan Log Aktivitas.',
        ],
        shots: [
            s('a07-tiket-detail', 'Detail tiket', 'Detail tiket: ringkasan, laporan, tanggapan, disposisi, dan tindak lanjut.'),
            s('a08-disposisi', 'Panel disposisi unit', 'Disposisi unit: unit penangan, catatan, serta tombol Alihkan dan Tarik.'),
            s('a09-tanggapan', 'Panel tanggapan', 'Tanggapan: balas ke pelapor atau simpan catatan internal.'),
            s('a10-tindak-lanjut', 'Panel tindak lanjut', 'Tindak lanjut: pilih status baru dan catatannya.'),
        ],
    },
    {
        id: 'a-chat',
        icon: MessagesSquare,
        title: 'Pesan Masuk',
        desc: (
            <>
                Percakapan Chat TARA yang diteruskan ke petugas, dipilah menjadi <strong>Menunggu</strong>, <strong>Dijawab AI</strong>,{' '}
                <strong>Selesai</strong>, dan <strong>Semua</strong>. Pilih percakapan, klik <strong>Ambil percakapan</strong>, baca ringkasan dari
                asisten, lalu balas di kolom bawah. Dari sini petugas dapat <strong>Terbitkan tiket</strong>, menandai <strong>Sudah terjawab</strong>
                , <strong>Rujuk ke portal</strong>, <strong>Rujuk ke Inspektorat</strong>, membantu <strong>daftarkan akun</strong> atau lupa kata
                sandi warga, dan <strong>minta konfirmasi data</strong> sebelum tiket terbit.
            </>
        ),
        shots: [s('a11-pesan-masuk', 'Pesan masuk', 'Pesan Masuk: daftar percakapan, ringkasan asisten, tindakan, dan balasan.')],
    },
    {
        id: 'a-rujukan',
        icon: Waypoints,
        title: 'Rujukan',
        desc: (
            <>
                Warga yang dirujuk ke portal lain (misalnya Trans Tuntas atau SP4N-LAPOR!). Petugas pendamping memantau sampai warga mengirim{' '}
                <strong>kode bukti</strong> dari portal tujuan. Tab <strong>Perlu tindakan</strong> menampilkan warga yang meminta bantuan; balas
                langsung ke warga atau masukkan kode tracking yang disampaikan lewat telepon.
            </>
        ),
        shots: [s('a12-rujukan', 'Rujukan', 'Rujukan: warga yang minta bantuan, pesan ke warga, dan riwayat pendampingan.')],
    },
    {
        id: 'a-manual',
        icon: Zap,
        title: 'Input Manual',
        desc: (
            <>
                Catat pengaduan yang masuk lewat <strong>tatap muka, telepon, surat/pos, live chat</strong>, atau media sosial (Instagram, X,
                Facebook, TikTok) agar ikut tercatat sebagai tiket. Isi sumber laporan, pelapor, dan isi laporan; daftar <strong>Kelengkapan</strong>{' '}
                di kanan menunjukkan isian wajib yang belum lengkap sebelum <strong>Terbitkan tiket</strong>.
            </>
        ),
        shots: [s('a13-input-manual', 'Input manual', 'Input Manual: pilih sumber laporan, isi pelapor dan laporan, lalu terbitkan tiket.')],
    },
    {
        id: 'a-internal',
        icon: Building2,
        title: 'Tiket Internal',
        desc: (
            <>
                Laporan gangguan sarana dan TIK kantor dari pegawai, dikirim lewat <strong>formulir internal</strong>. Hanya terlihat oleh Super Admin
                dan tidak pernah tampil di halaman publik. Penanganannya sama dengan tiket biasa lewat halaman detail.
            </>
        ),
        shots: [s('a14-tiket-internal', 'Tiket internal', 'Tiket Internal: laporan pegawai beserta NIP, unit, dan tenggat SLA.')],
    },
    {
        id: 'a-pengetahuan',
        icon: Library,
        title: 'Basis Pengetahuan',
        desc: (
            <>
                Sumber jawaban asisten TARA. Artikel berstatus <strong>Terbit</strong> dipakai menjawab warga; artikel baru menunggu tinjauan lewat{' '}
                <strong>Tinjau berurutan</strong>. Artikel dapat dibuat manual atau dari <strong>dokumen resmi</strong> (PDF/DOCX maks. 20 MB) yang
                diubah AI menjadi usulan tanya-jawab untuk ditinjau. <strong>Sumber Resmi</strong> mendaftarkan situs pemerintah yang dikutip langsung
                oleh asisten dan diambil ulang setiap pekan.
            </>
        ),
        tips: [
            'Kotak Uji pencarian menunjukkan artikel yang akan dipakai untuk sebuah pertanyaan.',
            'Panel "Belum bisa dijawab AI" mendaftar pertanyaan warga yang belum menemukan sumber; jadikan bahan artikel berikutnya.',
            'Situs sumber resmi dibatasi pada domain pemerintah yang diizinkan.',
        ],
        shots: [
            s('a15-pengetahuan', 'Basis pengetahuan', 'Basis Pengetahuan: daftar artikel, status tinjauan, dan uji pencarian.'),
            s(
                'a16-pengetahuan-dokumen',
                'Buat artikel dari dokumen resmi',
                'Buat artikel dari dokumen resmi: unggah, tinjau usulan AI, simpan sebagai draf.',
            ),
            s('a17-pengetahuan-sumber', 'Sumber resmi', 'Sumber Resmi: situs dan berkas resmi yang dikutip asisten.'),
        ],
    },
    {
        id: 'a-wilayah',
        icon: Map,
        title: 'Sebaran Wilayah',
        desc: (
            <>
                Rekap pengaduan per <strong>provinsi asal</strong>: total, berjalan, selesai, lewat SLA, lokasi yang paling sering disebut, dan
                tanggal laporan terakhir. Provinsi berasal dari isian warga di Chat TARA, formulir, atau Input Manual.
            </>
        ),
        shots: [s('a18-sebaran-wilayah', 'Sebaran wilayah', 'Sebaran Wilayah: rekap pengaduan per provinsi asal.')],
    },
    {
        id: 'a-kanal',
        icon: Radio,
        title: 'Manajemen Kanal',
        desc: (
            <>
                Daftar kanal pengaduan resmi (media sosial, kanal nasional, kantor pemerintahan, kanal internal) yang tampil di Katalog Pengaduan,
                serta <strong>integrasi kanal nasional</strong> SP4N-LAPOR! dan Whistleblowing System dengan tombol <strong>Sinkron sekarang</strong>.
            </>
        ),
        tips: ['Integrasi kanal nasional masih berupa uji coba; data yang ditarik belum berasal dari sistem sungguhan.'],
        shots: [s('a19-kanal', 'Manajemen kanal', 'Manajemen Kanal: kanal terdaftar dan integrasi kanal nasional.')],
    },
    {
        id: 'a-portal',
        icon: Globe,
        title: 'Katalog Portal',
        desc: (
            <>
                Portal Kementerian Transmigrasi yang boleh dirujuk oleh asisten dan petugas, misalnya Trans Tuntas, SP4N-LAPOR!, SIBARDUKTRANS, dan
                PPID. Atur siapa penggunanya (publik atau internal), periksa tautan dengan tombol <strong>Cek</strong>, dan pantau jumlah rujukan 30
                hari terakhir.
            </>
        ),
        tips: ['Portal internal tidak pernah ditawarkan ke warga.'],
        shots: [s('a20-katalog-portal', 'Katalog portal', 'Katalog Portal: daftar portal rujukan beserta status tautan dan jumlah rujukan.')],
    },
    {
        id: 'a-pengaturan',
        icon: Settings,
        title: 'Pengaturan',
        desc: (
            <>
                Tab <strong>Profil saya</strong> untuk nama, email notifikasi, dan kata sandi; <strong>SLA & EWS</strong> untuk tenggat per tingkat
                dampak; <strong>Kategori laporan</strong>; <strong>Notifikasi internal</strong>; dan <strong>Kanal resmi publik</strong> yang tampil
                di halaman publik.
            </>
        ),
        shots: [s('a21-pengaturan', 'Pengaturan', 'Pengaturan: profil admin dan tab pengaturan sistem.')],
    },
    {
        id: 'a-petugas',
        icon: Users,
        title: 'Daftar Admin',
        desc: (
            <>
                Khusus Super Admin: kelola akun petugas (nama, username, email notifikasi, <strong>Unit Kerja</strong>, peran, dan status). Unit Kerja
                petugas dapat diganti langsung dari tabel; petugas unit hanya melihat tiket yang didisposisikan ke unitnya.
            </>
        ),
        shots: [s('a22-petugas', 'Daftar admin', 'Daftar Admin: petugas beserta unit kerja, peran, dan status.')],
    },
    {
        id: 'a-unit',
        icon: Network,
        title: 'Unit Kerja',
        desc: (
            <>
                Khusus Super Admin: struktur unit Kementerian Transmigrasi (Eselon I dan Eselon II) yang menjadi tujuan disposisi tiket. Tambah unit
                dengan <strong>Unit baru</strong> atau <strong>Sub-unit</strong>, ubah dengan ikon pensil, dan hapus dengan ikon tempat sampah.
            </>
        ),
        tips: [
            'Unit yang masih punya sub-unit, petugas, atau tiket tidak bisa dihapus; nonaktifkan saja agar riwayat tiket tetap utuh.',
            'Unit nonaktif tidak bisa dipilih untuk petugas atau disposisi baru.',
        ],
        shots: [
            s('a23-unit-kerja', 'Unit kerja', 'Unit Kerja: pohon unit beserta jumlah petugasnya.'),
            s('a24-unit-baru', 'Form unit baru', 'Form Unit baru: nama resmi, singkatan, kode, induk, tingkat, urutan, dan email unit.'),
        ],
    },
    {
        id: 'a-kesehatan-ai',
        icon: Activity,
        title: 'Kesehatan AI',
        desc: (
            <>
                Khusus Super Admin: pantau status penyedia model asisten TARA, jumlah panggilan, tingkat galat, waktu respons, pemakaian token dan
                anggaran harian, serta antrean dan pemutus sirkuit. Hanya angka, tanpa isi percakapan.
            </>
        ),
        tips: ['Saat penyedia bermasalah berulang kali, sirkuit terbuka dan warga langsung diteruskan ke petugas.'],
        shots: [s('a25-kesehatan-ai', 'Kesehatan AI', 'Kesehatan AI: status penyedia, galat, waktu respons, dan pemakaian token.')],
    },
    {
        id: 'a-log',
        icon: ScrollText,
        title: 'Log Aktivitas',
        desc: (
            <>
                Khusus Super Admin: jejak audit yang tidak dapat diubah, berisi siapa melakukan apa dan kapan (masuk, tanggapan, perubahan status,
                disposisi, perubahan data master), lengkap dengan alamat IP.
            </>
        ),
        shots: [s('a26-log-aktivitas', 'Log aktivitas', 'Log Aktivitas: jejak audit aksi pengguna beserta waktunya.')],
    },
];

const ALUR_SINGKAT = [
    { icon: MessageSquare, label: 'Chat atau isi formulir', desc: 'Lewat TARA atau formulir pengaduan' },
    { icon: Zap, label: 'Tiket terbit', desc: 'Nomor TKT-YYMMDD-XXXXXX' },
    { icon: Network, label: 'Didisposisi', desc: 'Diteruskan ke unit kerja berwenang' },
    { icon: ShieldCheck, label: 'Ditindaklanjuti', desc: 'Status & tanggapan diperbarui' },
    { icon: Search, label: 'Lacak & survei', desc: 'Pantau status, lalu beri penilaian' },
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
        <TaraPage
            title="Panduan Lengkap"
            description="Panduan visual seluruh fitur Contact Center untuk masyarakat dan petugas."
            active="panduan"
            eyebrow="Pusat Bantuan"
            heading="Panduan Lengkap Contact Center"
            subtitle="Cara memakai setiap fitur, untuk masyarakat maupun petugas, dengan tangkapan layar aplikasi saat ini. Klik gambar untuk memperbesar dan gunakan tombol panah untuk berpindah."
            pose="menjelaskan"
            poseAlt="TARA menjelaskan cara memakai Contact Center"
        >
            <div className="font-body">
                {/* Alur singkat */}
                <section className="mx-auto max-w-[1312px] px-4 pt-10 sm:px-6 lg:px-16">
                    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {ALUR_SINGKAT.map(({ icon: Icon, label, desc }, i) => (
                            <li key={label} className="rounded-[18px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--t-gold)] text-xs font-bold text-[var(--t-deep)]">
                                        {i + 1}
                                    </span>
                                    <Icon className="h-4 w-4 text-[var(--tcd-link,var(--t-navy))]" />
                                </div>
                                <p className="font-heading text-sm font-bold text-[var(--tcd-heading,var(--t-deep))] uppercase">{label}</p>
                                <p className="mt-0.5 text-xs text-[var(--tcd-text-2,#5b6b7a)]">{desc}</p>
                            </li>
                        ))}
                    </ol>
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
                                        ? 'bg-brand border-[var(--tcd-link,var(--color-brand))] text-white shadow-lg'
                                        : 'hover:bg-brand-light/10 border-[var(--tcd-link,var(--color-brand-light))]/40 text-[var(--tcd-link,var(--color-brand))] hover:border-[var(--tcd-link,var(--color-brand-light))]',
                                )}
                            >
                                <Icon className="h-4 w-4" /> {label}
                            </button>
                        ))}
                    </div>

                    {/* INDEKS FITUR */}
                    <div className="mb-12 rounded-xl border border-[var(--tcd-border,oklch(0.967_0.003_264.542))] bg-[var(--tcd-surface,#fff)] p-6 shadow-md">
                        <h2 className="font-heading mb-4 flex items-center gap-2 text-sm font-bold tracking-[2px] text-[var(--tcd-link,var(--color-brand))] uppercase">
                            <BookOpen className="h-4 w-4 text-[var(--tcd-link,var(--color-brand-light))]" /> Daftar Fitur —{' '}
                            {tab === 'warga' ? 'Masyarakat' : 'Admin'}
                        </h2>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {fitur.map((f, i) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => jump(f.id)}
                                    className="group hover:bg-brand-light/10 flex items-center gap-2 rounded-lg border border-[var(--tcd-link,var(--color-brand-light))]/30 px-3 py-2 text-left text-sm transition hover:border-[var(--tcd-link,var(--color-brand-light))]"
                                >
                                    <span className="bg-brand-light/15 group-hover:bg-brand-light flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[var(--tcd-link,var(--color-brand-light))] transition group-hover:text-white">
                                        {i + 1}
                                    </span>
                                    <span className="truncate font-medium text-[var(--tcd-text-2,oklch(0.373_0.034_259.733))] group-hover:text-[var(--tcd-link,var(--color-brand))]">
                                        {f.title}
                                    </span>
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
                                        <h2 className="font-heading flex flex-wrap items-center gap-2 text-xl leading-tight font-bold tracking-tight text-[var(--tcd-link,var(--color-brand))] uppercase md:text-2xl">
                                            <f.icon className="h-6 w-6 shrink-0 text-[var(--tcd-link,var(--color-brand-light))]" />
                                            {f.title}
                                        </h2>
                                        <div className="bg-brand-light mt-2 h-[3px] w-14 rounded-full" />
                                    </div>
                                </div>
                                <p className="mb-4 leading-relaxed text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))] md:ml-16">{f.desc}</p>
                                {f.tips && (
                                    <ul className="mb-5 space-y-2 md:ml-16">
                                        {f.tips.map((t) => (
                                            <li key={t} className="flex items-start gap-2 text-sm text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))]">
                                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tcd-link,var(--color-brand-light))]" />
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
                                                className="group block w-full cursor-zoom-in overflow-hidden rounded-xl border border-[var(--tcd-border,oklch(0.928_0.006_264.531))] bg-[var(--tcd-surface,#fff)] shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                                                aria-label={`Perbesar gambar: ${shot.caption}`}
                                            >
                                                <img src={shot.src} alt={shot.alt} loading="lazy" className="w-full" />
                                            </button>
                                            <figcaption className="mt-2 flex items-start gap-2 text-xs text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">
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
                    <div className="mt-14 overflow-hidden rounded-xl border border-[var(--tcd-border,oklch(0.967_0.003_264.542))] bg-[var(--tcd-surface,#fff)] shadow-md">
                        <div className="bg-brand-light/5 flex flex-col items-start gap-4 border-l-4 border-[var(--tcd-link,var(--color-brand-light))] p-6 md:flex-row md:items-center">
                            <div className="bg-brand-light/10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[var(--tcd-link,var(--color-brand-light))]">
                                <Lightbulb className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-heading mb-1 font-bold tracking-tight text-[var(--tcd-link,var(--color-brand))] uppercase">
                                    Ketentuan Lampiran & Data
                                </h3>
                                <p className="text-sm leading-relaxed text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))]">
                                    Lampiran bukti menerima berkas <strong>JPG, PNG, atau PDF</strong> dengan ukuran maksimal <strong>5 MB</strong>.
                                    Uraian laporan minimal 10 karakter dan NIK pelapor wajib 16 digit. NIK disimpan terenkripsi dan tidak pernah
                                    ditampilkan ke publik. Perlu memperbaiki laporan yang sudah terkirim? Sampaikan lewat <strong>Chat TARA</strong>{' '}
                                    dengan menyebut nomor tiketnya.
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
                            {
                                icon: BookOpen,
                                title: 'Pedoman Layanan',
                                desc: 'Standar pelayanan & maklumat resmi Contact Center.',
                                href: '/pedoman-layanan',
                            },
                            { icon: Search, title: 'Lacak Tiket', desc: 'Pantau status laporan Anda kapan saja.', href: '/lacak' },
                            { icon: Inbox, title: 'Katalog Pengaduan', desc: 'Daftar kanal & kategori layanan pengaduan.', href: '/katalog' },
                        ].map(({ icon: Icon, title, desc, href }) => (
                            <Link
                                key={href}
                                href={href}
                                className="group rounded-xl border border-[var(--tcd-border,oklch(0.967_0.003_264.542))] bg-[var(--tcd-surface,#fff)] p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                            >
                                <div className="bg-brand-light/10 group-hover:bg-brand-light mb-4 flex h-12 w-12 items-center justify-center rounded-full text-[var(--tcd-link,var(--color-brand-light))] transition group-hover:text-white">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <h3 className="font-heading font-bold tracking-tight text-[var(--tcd-link,var(--color-brand))] uppercase">{title}</h3>
                                <p className="mt-1 text-sm text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">{desc}</p>
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
                                    className="absolute top-1/2 -left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--tcd-surface,#fff)]/90 text-[var(--tcd-text,oklch(0.278_0.033_256.848))] shadow-lg transition hover:bg-[var(--tcd-surface,#fff)] md:-left-14"
                                    aria-label="Gambar sebelumnya"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLightbox((l) => l && { ...l, index: (l.index + 1) % l.shots.length })}
                                    className="absolute top-1/2 -right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--tcd-surface,#fff)]/90 text-[var(--tcd-text,oklch(0.278_0.033_256.848))] shadow-lg transition hover:bg-[var(--tcd-surface,#fff)] md:-right-14"
                                    aria-label="Gambar berikutnya"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => setLightbox(null)}
                            className="absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tcd-surface,#fff)] text-[var(--tcd-text,oklch(0.278_0.033_256.848))] shadow-lg transition hover:bg-[var(--tcd-muted-2,oklch(0.928_0.006_264.531))] md:-top-4 md:-right-4"
                            aria-label="Tutup gambar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </TaraPage>
    );
}
