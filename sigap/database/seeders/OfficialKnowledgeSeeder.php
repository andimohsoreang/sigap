<?php

namespace Database\Seeders;

use App\Models\KnowledgeArticle;
use Illuminate\Database\Seeder;

/**
 * Bahan awal Basis Pengetahuan dari sumber resmi yang terbuka untuk umum:
 * portal PPID, JDIH, dan SIBARDUKTRANS Kementerian Transmigrasi, serta teks
 * UU 15/1997 sebagaimana diubah UU 29/2009. Diambil 17 Oktober 2026.
 *
 * Isi disusun ulang (bukan disalin) dalam bahasa warga, dan SEMUA artikel
 * masuk berstatus "ditinjau": Super Admin wajib mencocokkan angka, jangka
 * waktu, dan rujukan pasal dengan dokumen aslinya sebelum menerbitkan.
 *
 * Aman dijalankan ulang: artikel yang judulnya sudah ada tidak disentuh,
 * sehingga suntingan petugas tidak tertimpa.
 */
class OfficialKnowledgeSeeder extends Seeder
{
    private const PPID = 'PPID Kementerian Transmigrasi';

    private const UU = 'UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian';

    private const JDIH = 'JDIH Kementerian Transmigrasi';

    private const URL_UU = 'https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang';

    /** Dasar hukum persyaratan calon transmigran (FR-AI-11), terverifikasi dari naskah JDIH read/814. */
    private const PERMENTRANS_2_2024 = 'Permentrans 2/2024 tentang Penataan Persebaran Penduduk di Kawasan Transmigrasi';

    public function run(): void
    {
        foreach ($this->articles() as $article) {
            KnowledgeArticle::query()->firstOrCreate(
                ['title' => $article['title']],
                $article + [
                    'status' => KnowledgeArticle::STATUS_REVIEW,
                    'review_at' => now()->addMonths(6)->toDateString(),
                ],
            );
        }
    }

    /**
     * @return list<array{title: string, body: string, category: string, keywords: string, source: string, source_ref: string, source_url: string, dasar_hukum?: string, tanggal_dasar?: string, status_dasar?: string}>
     */
    public function articles(): array
    {
        return [
            // ---------------------------------------------------------------
            // Layanan informasi publik (PPID)
            // ---------------------------------------------------------------
            [
                'title' => 'Bagaimana cara meminta informasi publik dari Kementerian Transmigrasi?',
                'body' => "Permohonan informasi publik dilayani PPID Kementerian Transmigrasi, bukan melalui SIGAP.\n1. Isi formulir Permohonan Informasi di ppid.transmigrasi.go.id, atau datang langsung ke ruang layanan PPID pada jam layanan.\n2. Siapkan identitas (KTP), rincian informasi yang diminta, tujuan penggunaan, serta cara memperoleh dan cara pengiriman informasi yang diinginkan.\n3. Simpan nomor registrasi yang diberikan untuk melacak status permohonan.\n4. PPID memeriksa kelengkapan, menelusuri informasi ke unit kerja terkait, lalu memberi tanggapan tertulis.",
                'category' => 'Informasi Publik',
                'keywords' => 'permohonan informasi, minta data, dokumen, salinan, PPID, keterbukaan informasi',
                'source' => self::PPID.' — Prosedur Permohonan',
                'source_ref' => 'Dasar: UU 14/2008',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/prosedur-permohonan',
            ],
            [
                'title' => 'Berapa lama permohonan informasi publik dijawab?',
                'body' => 'PPID memberi tanggapan tertulis paling lambat 10 hari kerja sejak permohonan diterima lengkap. Bila belum dapat dipenuhi, jangka waktunya dapat diperpanjang 7 hari kerja dengan pemberitahuan tertulis disertai alasan. Permohonan daring dapat diajukan kapan saja, tetapi diproses pada hari kerja.',
                'category' => 'Informasi Publik',
                'keywords' => 'jangka waktu, hari kerja, perpanjangan, tanggapan, jawaban permohonan',
                'source' => self::PPID.' — Waktu & Biaya Layanan',
                'source_ref' => 'Dasar: UU 14/2008',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/waktu-biaya',
            ],
            [
                'title' => 'Apakah meminta informasi publik dikenai biaya?',
                'body' => 'Pengajuan permohonan informasi melalui portal PPID tidak dipungut biaya. Informasi diutamakan diberikan dalam bentuk salinan digital melalui email. Bila pemohon meminta salinan fisik, biaya penggandaan dan pengiriman dapat dibebankan kepada pemohon sesuai standar biaya yang berlaku, dan PPID memberitahukannya lebih dulu sebelum diproses.',
                'category' => 'Informasi Publik',
                'keywords' => 'gratis, biaya, bayar, fotokopi, salinan fisik, ongkos kirim',
                'source' => self::PPID.' — Waktu & Biaya Layanan',
                'source_ref' => 'Dasar: UU 14/2008, PP 61/2010',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/waktu-biaya',
            ],
            [
                'title' => 'Bagaimana cara melacak status permohonan informasi di PPID?',
                'body' => 'Buka menu Cek Status Pengajuan di portal PPID Kementerian Transmigrasi, lalu masukkan nomor registrasi dan email yang Anda gunakan saat mengajukan permohonan. Nomor tiket SIGAP tidak berlaku untuk permohonan informasi PPID.',
                'category' => 'Informasi Publik',
                'keywords' => 'lacak permohonan, nomor registrasi, cek status PPID',
                'source' => self::PPID.' — FAQ',
                'source_ref' => 'Layanan Informasi Publik',
                'source_url' => 'https://ppid.transmigrasi.go.id/permohonan/lacak',
            ],
            [
                'title' => 'Bagaimana jika permohonan informasi saya ditolak atau tidak dijawab?',
                'body' => "Anda dapat mengajukan keberatan kepada Atasan PPID (Sekretaris Jenderal Kementerian Transmigrasi).\n1. Ajukan melalui menu Pengajuan Keberatan di portal PPID, paling lambat 30 hari kerja sejak jawaban diterima atau sejak batas waktu tanggapan terlampaui.\n2. Isi formulir keberatan dan simpan tanda terima sebagai bukti.\n3. Atasan PPID menanggapi paling lambat 30 hari kerja sejak keberatan diajukan, dan Anda menerima keputusan tertulis.",
                'category' => 'Informasi Publik',
                'keywords' => 'keberatan, ditolak, tidak dijawab, banding, Atasan PPID, Sekretaris Jenderal',
                'source' => self::PPID.' — Prosedur Keberatan',
                'source_ref' => 'Dasar: Perki 1/2021',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/prosedur-keberatan',
            ],
            [
                'title' => 'Bagaimana jika saya tidak puas dengan keputusan Atasan PPID?',
                'body' => "1. Ajukan penyelesaian sengketa informasi ke Komisi Informasi paling lambat 14 hari kerja sejak keputusan Atasan PPID.\n2. Komisi Informasi memproses pengajuan paling lambat 14 hari kerja dan menyelesaikannya melalui mediasi; bila tidak tercapai kesepakatan, dilanjutkan ajudikasi.\n3. Bila tidak menerima hasil ajudikasi, nyatakan penolakan secara tertulis, lalu Anda dapat mengajukan gugatan ke pengadilan paling lambat 14 hari kerja sejak putusan Komisi Informasi.",
                'category' => 'Informasi Publik',
                'keywords' => 'sengketa informasi, Komisi Informasi, mediasi, ajudikasi, gugatan pengadilan',
                'source' => self::PPID.' — Prosedur Keberatan',
                'source_ref' => 'Dasar: Perki 1/2021',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/prosedur-keberatan',
            ],
            [
                'title' => 'Informasi apa yang dikecualikan dan tidak dapat diberikan?',
                'body' => 'Informasi yang dikecualikan adalah informasi yang bila dibuka dapat, antara lain, menghambat penegakan hukum, mengganggu perlindungan hak kekayaan intelektual, atau membahayakan pertahanan dan keamanan negara, serta kategori lain sesuai Pasal 17 UU 14/2008. Setiap penolakan atas informasi yang dikecualikan wajib disertai alasan tertulis berdasarkan uji konsekuensi.',
                'category' => 'Informasi Publik',
                'keywords' => 'dikecualikan, rahasia, tidak boleh dibuka, uji konsekuensi, Pasal 17',
                'source' => self::PPID.' — FAQ',
                'source_ref' => 'Pasal 17 UU 14/2008',
                'source_url' => 'https://ppid.transmigrasi.go.id/faq',
            ],
            [
                'title' => 'Apa saja jenis informasi publik dan di mana daftarnya?',
                'body' => 'Informasi publik terdiri atas informasi yang wajib diumumkan secara berkala, informasi yang wajib diumumkan serta-merta, informasi yang wajib tersedia setiap saat, dan informasi yang dikecualikan. Tiga jenis pertama dapat ditelusuri di menu Informasi Publik (Daftar Informasi Publik) portal PPID Kementerian Transmigrasi, lengkap dengan pencarian dan filter kategori.',
                'category' => 'Informasi Publik',
                'keywords' => 'informasi berkala, serta merta, setiap saat, daftar informasi publik, DIP',
                'source' => self::PPID.' — FAQ',
                'source_ref' => 'Informasi Publik',
                'source_url' => 'https://ppid.transmigrasi.go.id/faq',
            ],
            [
                'title' => 'Apa itu PPID dan siapa pejabatnya di Kementerian Transmigrasi?',
                'body' => 'PPID (Pejabat Pengelola Informasi dan Dokumentasi) adalah pejabat yang bertanggung jawab atas penyimpanan, pendokumentasian, penyediaan, dan pelayanan informasi di badan publik. Di Kementerian Transmigrasi, Atasan PPID adalah Sekretaris Jenderal dan PPID Utama dijabat Kepala Biro Perencanaan, Kerja Sama, dan Hubungan Masyarakat. PPID Pelaksana berada di Ditjen Pembangunan dan Pengembangan Kawasan Transmigrasi, Ditjen Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi, serta Inspektorat Jenderal.',
                'category' => 'Informasi Publik',
                'keywords' => 'pejabat pengelola informasi, PPID utama, PPID pelaksana, struktur PPID',
                'source' => self::PPID.' — FAQ',
                'source_ref' => 'PPID',
                'source_url' => 'https://ppid.transmigrasi.go.id/faq',
            ],
            [
                'title' => 'Kapan jam layanan dan bagaimana menghubungi PPID Kementerian Transmigrasi?',
                'body' => "Jam layanan langsung: Senin–Jumat, 08.00–15.00 WIB (tidak tersedia pada hari libur nasional dan cuti bersama). Permohonan daring dapat diajukan kapan saja.\n- Portal: ppid.transmigrasi.go.id\n- Telepon: 021-7994372\n- Email: ppid@transmigrasi.go.id\n- WhatsApp: tersedia melalui tombol di portal PPID\n- Alamat: Jl. TMP Kalibata No. 17, Rawajati, Pancoran, Jakarta Selatan 12750",
                'category' => 'Informasi Publik',
                'keywords' => 'jam buka, alamat kantor, nomor telepon, email PPID, WhatsApp, Kalibata',
                'source' => self::PPID.' — Kanal Layanan',
                'source_ref' => 'Kanal Layanan; Waktu & Biaya',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/kanal-layanan',
            ],
            [
                'title' => 'Bagaimana melaporkan dugaan penyalahgunaan wewenang oleh pejabat Kementerian Transmigrasi?',
                'body' => "Pengaduan dapat disampaikan dengan datang langsung ke information centre Kementerian Transmigrasi pada jam kerja, melalui email humas@transmigrasi.go.id, mengisi formulir daring atau tertulis kepada PPID, atau melalui surat/kotak pengaduan.\nPengaduan tertulis memuat identitas pelapor dan terlapor, perbuatan yang diduga dilanggar beserta waktu dan tempat kejadian, serta bukti atau keterangan pendukung. Pengaduan tanpa identitas lengkap tetap dapat ditindaklanjuti bila isinya logis dan memadai.\nPPID meneruskan pengaduan kepada Menteri, yang memprosesnya paling lambat 30 hari kerja dan mendisposisikannya kepada Inspektur Jenderal. Jawaban disampaikan kepada pelapor melalui PPID.",
                'category' => 'Pengaduan',
                'keywords' => 'penyalahgunaan wewenang, pejabat nakal, pungli, Inspektorat Jenderal, whistleblowing',
                'source' => self::PPID.' — Pengaduan Penyalahgunaan Wewenang',
                'source_ref' => 'Standar Layanan',
                'source_url' => 'https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang',
            ],
            [
                'title' => 'Apa tugas dan fungsi Kementerian Transmigrasi?',
                'body' => "Kementerian Transmigrasi bertugas menyelenggarakan urusan pemerintahan di bidang transmigrasi untuk membantu Presiden. Fungsinya antara lain:\n- merumuskan, menetapkan, dan melaksanakan kebijakan pembangunan dan pengembangan kawasan transmigrasi, serta pengembangan ekonomi dan pemberdayaan masyarakat transmigrasi;\n- bimbingan teknis dan supervisi urusan kementerian di daerah;\n- koordinasi, pembinaan, dan dukungan administrasi di lingkungan kementerian;\n- pengelolaan barang milik negara dan pengawasan pelaksanaan tugas di lingkungan kementerian.",
                'category' => 'Kelembagaan',
                'keywords' => 'tugas kementerian, fungsi kementerian, Kementrans, Perpres 172/2024',
                'source' => 'Perpres 172/2024 tentang Kementerian Transmigrasi',
                'source_ref' => 'Pasal 5 (tugas) dan Pasal 6 (fungsi)',
                'source_url' => 'https://ppid.transmigrasi.go.id/kementerian/tugas-fungsi',
            ],

            // ---------------------------------------------------------------
            // Ketentuan pokok ketransmigrasian (UU 15/1997 jo. UU 29/2009)
            // ---------------------------------------------------------------
            [
                'title' => 'Apa yang dimaksud dengan transmigrasi, transmigran, dan kawasan transmigrasi?',
                'body' => "- Transmigrasi: perpindahan penduduk secara sukarela untuk meningkatkan kesejahteraan dan menetap di kawasan transmigrasi yang diselenggarakan oleh Pemerintah.\n- Transmigran: warga negara Republik Indonesia yang berpindah secara sukarela ke kawasan transmigrasi.\n- Kawasan transmigrasi: kawasan budi daya yang berfungsi sebagai permukiman dan tempat usaha masyarakat, berupa wilayah pengembangan transmigrasi atau lokasi permukiman transmigrasi.",
                'category' => 'Ketentuan Pokok',
                'keywords' => 'pengertian, arti transmigrasi, definisi, permukiman transmigrasi',
                'source' => self::UU,
                'source_ref' => 'Pasal 1 (UU 29/2009)',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Apa saja jenis transmigrasi?',
                'body' => "Ada tiga jenis transmigrasi:\n1. Transmigrasi Umum (TU): dilaksanakan Pemerintah dan/atau pemerintah daerah bagi penduduk yang mengalami keterbatasan dalam mendapatkan peluang kerja dan usaha.\n2. Transmigrasi Swakarsa Berbantuan (TSB): dirancang Pemerintah dan/atau pemerintah daerah dengan mengikutsertakan badan usaha sebagai mitra usaha transmigran, bagi penduduk yang berpotensi berkembang untuk maju.\n3. Transmigrasi Swakarsa Mandiri (TSM): prakarsa transmigran sendiri atas arahan, layanan, dan bantuan Pemerintah dan/atau pemerintah daerah, bagi penduduk yang telah memiliki kemampuan.\nKetiganya diselenggarakan melalui pola usaha pokok.",
                'category' => 'Ketentuan Pokok',
                'keywords' => 'jenis transmigrasi, TU, TSB, TSM, transmigrasi umum, swakarsa berbantuan, swakarsa mandiri, macam',
                'source' => self::UU,
                'source_ref' => 'Pasal 1 & Pasal 6',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Siapa yang boleh menjadi transmigran dan apa syaratnya?',
                'body' => "- Setiap warga negara Republik Indonesia dapat ikut serta sebagai transmigran.\n- Keikutsertaan bersifat sukarela dan wajib memenuhi persyaratan yang ditetapkan.\n- Transmigran terdiri atas kepala keluarga beserta anggota keluarganya; untuk kepentingan tertentu Pemerintah dapat menetapkan pengecualian.\n- Rincian persyaratan dan pengecualiannya diatur dalam Peraturan Menteri, dan setiap calon transmigran diseleksi oleh Pemerintah.\nKelayakan seseorang tidak dapat dipastikan lewat chat; untuk ketentuan pendaftaran yang berlaku, tanyakan kepada petugas.",
                'category' => 'Ketentuan Pokok',
                'keywords' => 'syarat transmigran, persyaratan, daftar transmigrasi, ikut transmigrasi, calon transmigran, peserta, kepala keluarga',
                'source' => self::UU,
                'source_ref' => 'Pasal 10 & Pasal 27',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Apa saja persyaratan calon transmigran dari daerah asal?',
                'body' => "Persyaratan calon Transmigran Karya Nusantara (TKN) daerah asal:\n1. Warga negara Indonesia yang memiliki KTP-el.\n2. Berkeluarga, dibuktikan dengan surat nikah dan KK. Boleh belum berkeluarga bila memiliki keahlian tertentu yang dibuktikan sertifikat (mis. tenaga kesehatan, tenaga pendidikan, jasa konstruksi, perbengkelan, las, kerajinan, pengolahan hasil pertanian).\n3. Berusia 19–53 tahun (48–53 tahun bagi purnabakti TNI/Polri).\n4. Diutamakan minimal lulusan SMP/sederajat.\n5. Sehat, dibuktikan surat keterangan dokter.\n6. Menyatakan tekad mengembangkan kehidupan di permukiman transmigrasi dengan surat pernyataan.\n7. Memiliki kemampuan mengembangkan usaha dan/atau budi daya di kawasan transmigrasi, dibuktikan sertifikat pelatihan dari lembaga pelatihan yang berwenang.\n8. Belum pernah bertransmigrasi, dibuktikan surat keterangan perangkat daerah bidang ketransmigrasian.\n9. Mengikuti seleksi dan pelatihan komponen cadangan (Komcad), dan lulus seleksi.",
                'category' => 'Pendaftaran Transmigran',
                'keywords' => 'syarat transmigran, persyaratan calon transmigran, usia transmigran, umur, KTP, KK, surat nikah, surat sehat, belum berkeluarga, lajang, TKN, Komcad, sertifikat pelatihan, syarat peserta, syarat ikut transmigrasi, syarat menjadi transmigran',
                'source' => 'SIBARDUKTRANS — Tata Cara Bertransmigrasi',
                'source_ref' => 'Persyaratan TKN daerah asal',
                'source_url' => 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi',
                'dasar_hukum' => self::PERMENTRANS_2_2024.' (Pasal 6 ayat (3))',
                'tanggal_dasar' => '2024-12-09',
                'status_dasar' => 'berlaku',
            ],
            [
                'title' => 'Apa syarat penduduk setempat untuk menjadi transmigran lokal?',
                'body' => "Penduduk yang tinggal di Satuan Permukiman (SP) Pugar dapat memperoleh perlakuan sebagai transmigran, baik yang memiliki tanah dan rumah, memiliki tanah tanpa rumah, maupun tidak memiliki keduanya. Syaratnya:\n1. Terdaftar dalam dokumen RTSP-Pugar.\n2. Memiliki KTP di permukiman yang akan dikembangkan menjadi SP-Pugar tersebut.\n3. Berkeluarga.\n4. Sudah tinggal menetap dan memanfaatkan tanah di permukiman itu paling singkat 2 tahun.\n5. Diutamakan minimal lulusan SMP/sederajat, dan sehat (surat keterangan dokter).\n6. Membuat surat pernyataan tekad, belum pernah bertransmigrasi, dan lulus seleksi.",
                'category' => 'Pendaftaran Transmigran',
                'keywords' => 'transmigran lokal, penduduk setempat, TPS, SP Pugar, RTSP, warga sekitar kawasan',
                'source' => 'SIBARDUKTRANS — Tata Cara Bertransmigrasi',
                'source_ref' => 'Persyaratan transmigran penduduk setempat',
                'source_url' => 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi',
                'dasar_hukum' => self::PERMENTRANS_2_2024.' (Pasal 9 ayat (3))',
                'tanggal_dasar' => '2024-12-09',
                'status_dasar' => 'berlaku',
            ],
            [
                'title' => 'Di mana dan bagaimana cara mendaftar sebagai calon transmigran?',
                'body' => "Pendaftaran dapat dilakukan di:\n- kantor desa/kelurahan domisili Anda;\n- perangkat daerah kabupaten/kota yang menangani transmigrasi, sesuai penerbit KTP Anda;\n- secara daring melalui SIBARDUKTRANS di https://sibarduktrans.transmigrasi.go.id/pendaftaran (buat akun dengan nomor telepon, email, dan kata sandi).\nSetelah terdaftar, perangkat daerah melakukan seleksi administrasi (pencocokan dokumen identitas dengan data kependudukan) lalu seleksi teknis berupa wawancara, tes tertulis, serta pemeriksaan kesehatan fisik dan mental. Pendaftar yang tidak hadir pada seleksi teknis dianggap mengundurkan diri. Calon yang ditetapkan berhak mengikuti pelatihan. Pendaftaran menjadi calon transmigran tidak dipungut biaya.",
                'category' => 'Pendaftaran Transmigran',
                'keywords' => 'cara daftar transmigrasi, tempat pendaftaran, daftar online, seleksi administrasi, seleksi teknis, wawancara, tes kesehatan, kantor desa, dinas transmigrasi',
                'source' => 'SIBARDUKTRANS — Tata Cara Bertransmigrasi',
                'source_ref' => 'Pendaftaran & Seleksi; formulir Pendaftaran Akun',
                'source_url' => 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi',
            ],
            [
                'title' => 'Siapa yang diutamakan menjadi peserta Transmigrasi Umum?',
                'body' => "Transmigrasi Umum diutamakan bagi penduduk yang berasal dari:\n1. wilayah berkepadatan penduduk tinggi, terbatas lapangan kerjanya, dan/atau berlahan kritis;\n2. daerah yang terkena bencana alam atau gangguan keamanan;\n3. perambah hutan dan peladang berpindah; dan\n4. wilayah yang tempat tinggalnya dijadikan proyek pembangunan untuk kepentingan umum.\nPrioritas ini tidak mengurangi hak setiap warga negara untuk ikut serta sebagai transmigran.",
                'category' => 'Ketentuan Pokok',
                'keywords' => 'prioritas, diutamakan, korban bencana, terdampak proyek, peladang berpindah',
                'source' => self::UU,
                'source_ref' => 'Pasal 12',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Bagaimana proses seleksi, pelatihan, dan penempatan calon transmigran?',
                'body' => "1. Seleksi: Pemerintah menyeleksi setiap calon transmigran. Calon Transmigrasi Umum diseleksi berdasarkan prioritas penanganan masalah sosial ekonomi; calon Transmigrasi Swakarsa Berbantuan dan Swakarsa Mandiri diseleksi berdasarkan kesesuaian kesempatan kerja atau usaha dengan kesiapan dan keahliannya.\n2. Pelatihan: calon yang lulus seleksi diberi pendidikan dan pelatihan sesuai kebutuhan pengembangan.\n3. Penempatan: dilaksanakan setelah ada kepastian kesempatan kerja atau usaha dan tempat tinggal. Penempatan TU dilakukan Pemerintah dan/atau pemerintah daerah; TSB dapat mengikutsertakan badan usaha; TSM dilakukan sendiri oleh transmigran atau badan usaha penyedia lapangan kerja dan dapat dibantu pemerintah.",
                'category' => 'Ketentuan Pokok',
                'keywords' => 'seleksi, tes, pelatihan, diklat, penempatan, berangkat, tahapan, alur',
                'source' => self::UU,
                'source_ref' => 'Pasal 27–30',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Bantuan apa yang diterima transmigran Transmigrasi Umum?',
                'body' => "Pada Transmigrasi Umum, transmigran berhak memperoleh bantuan dari Pemerintah dan/atau pemerintah daerah berupa:\n- perbekalan, pengangkutan dari daerah asal, dan penempatan di permukiman transmigrasi;\n- sarana produksi sesuai komoditas unggulan kawasan (misalnya pupuk dan benih untuk pertanian, peralatan tangkap untuk perikanan, ternak dan pakan untuk peternakan);\n- catu pangan untuk jangka waktu tertentu, yaitu bantuan natura dan/atau non-natura untuk meringankan biaya hidup agar transmigran dapat mulai bekerja atau berusaha di permukiman transmigrasi;\n- lahan usaha dan lahan tempat tinggal beserta rumah dengan status hak milik (pemberian hak milik dilakukan setelah transmigran memenuhi persyaratan yang ditetapkan Menteri).\nPelaksanaan pemberian bantuan diatur lebih lanjut dengan Peraturan Menteri. Hak bantuan perorangan hanya dapat diperiksa oleh petugas.",
                'category' => 'Hak & Kewajiban',
                'keywords' => 'bantuan transmigran, hak transmigran, jatah hidup, jadup, catu pangan, sarana produksi, bibit, pupuk, rumah',
                'source' => self::UU,
                'source_ref' => 'Pasal 7 ayat (2), Pasal 13 & penjelasan (UU 29/2009); Pasal 24 ayat (3) & penjelasan (UU 15/1997)',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Bantuan apa yang diterima transmigran Transmigrasi Swakarsa Berbantuan?',
                'body' => "Transmigran Swakarsa Berbantuan berhak memperoleh bantuan dari Pemerintah dan/atau pemerintah daerah berupa:\n(a) pelayanan perpindahan dan penempatan di permukiman transmigrasi (penampungan, pengangkutan, dan penempatan);\n(b) sarana usaha atau lahan usaha dengan status hak milik atau status lain sesuai pola usahanya. Lahan usaha di area Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik, sedangkan di luar area itu statusnya mengikuti status asal lahan;\n(c) lahan tempat tinggal beserta rumah dengan status hak milik;\n(d) sebagian kebutuhan sarana produksi; dan\n(e) bimbingan, pengembangan, dan perlindungan hubungan kemitraan usaha.\nTransmigran juga dapat memperoleh catu pangan, yang diberikan bila pada awal kedatangan belum berpenghasilan memadai. Menurut penjelasan undang-undang, bantuan ini diarahkan pada aset produksi tetap untuk mengurangi beban kredit transmigran.\nBadan usaha mitra membantu transmigran memperoleh akses modal, teknologi, dan manajemen usaha. Badan usaha mitra juga membantu perolehan kredit investasi dan modal kerja, bimbingan dan pelatihan usaha, informasi usaha, jaminan pemasaran hasil, jaminan pendapatan layak, bimbingan sosial, serta fasilitas umum dan sosial (Pasal 14 ayat (3)).",
                'category' => 'Hak & Kewajiban',
                'keywords' => 'TSB, swakarsa berbantuan, badan usaha, kemitraan, plasma, modal, kredit',
                'source' => self::UU,
                'source_ref' => 'Pasal 8 dan Pasal 14 beserta penjelasannya (UU 29/2009)',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Bantuan apa yang diterima transmigran Transmigrasi Swakarsa Mandiri?',
                'body' => "Transmigran Swakarsa Mandiri berhak memperoleh bantuan Pemerintah dan/atau pemerintah daerah berupa:\n1. pengurusan perpindahan dan penempatan di permukiman transmigrasi;\n2. bimbingan untuk mendapatkan lapangan kerja atau usaha, atau fasilitasi mendapatkan lahan usaha;\n3. lahan tempat tinggal dengan status hak milik; dan\n4. bimbingan, pengembangan, dan perlindungan hubungan kemitraan usaha.\nKebutuhan pengembangan usaha di luar bantuan tersebut diupayakan secara swadaya dan/atau melalui bantuan badan usaha.",
                'category' => 'Hak & Kewajiban',
                'keywords' => 'TSM, swakarsa mandiri, transmigrasi mandiri, bantuan mandiri',
                'source' => self::UU,
                'source_ref' => 'Pasal 15 (UU 29/2009)',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Apa kewajiban transmigran dan apa sanksinya bila dilanggar?',
                'body' => "Setiap transmigran wajib:\n1. bertempat tinggal menetap di permukiman transmigrasi;\n2. memelihara kelestarian lingkungan;\n3. memelihara dan mengembangkan kegiatan usahanya secara berdaya guna dan berhasil guna;\n4. mempertahankan dan memelihara pemilikan tanah dan aset produksinya;\n5. memelihara hubungan yang serasi dengan masyarakat setempat serta menghormati dan memperhatikan adat istiadatnya; dan\n6. mematuhi ketentuan ketransmigrasian.\nTransmigran yang tidak melaksanakan kewajiban ini dikenakan sanksi administratif berupa teguran lisan, teguran tertulis, atau pencabutan status sebagai transmigran (Pasal 35D UU 29/2009); tata cara penjatuhannya diatur dengan Peraturan Pemerintah (Pasal 35F).",
                'category' => 'Hak & Kewajiban',
                'keywords' => 'kewajiban transmigran, larangan, sanksi, pencabutan status, meninggalkan lokasi, menjual lahan',
                'source' => self::UU,
                'source_ref' => 'Pasal 16 & Pasal 35D',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Apakah lahan untuk transmigran diberikan dengan status hak milik?',
                'body' => "Pada prinsipnya ya. Pemerintah menyediakan tanah bagi penyelenggaraan transmigrasi sesuai rencana tata ruang wilayah. Tanah yang diperoleh Pemerintah untuk transmigrasi diberikan dengan hak pengelolaan, lalu tanah yang diperuntukkan bagi transmigran diberikan dengan status hak milik. Menurut penjelasan undang-undang, hak milik diberikan setelah transmigran memenuhi persyaratan tertentu yang ditetapkan Menteri. Bila tanah yang akan diberikan dikuasai badan usaha, tanah tersebut lebih dulu diserahkan kepada Pemerintah.\nPada Transmigrasi Swakarsa Berbantuan, lahan usaha di areal Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik; di luar areal itu statusnya mengikuti status asal lahan.\nPada Transmigrasi Umum, lahan usaha dan lahan tempat tinggal beserta rumah diberikan dengan status hak milik. Pada Transmigrasi Swakarsa Berbantuan, lahan tempat tinggal beserta rumah berstatus hak milik, sedangkan lahan atau sarana usaha berstatus hak milik atau status lain sesuai pola usahanya. Pada Transmigrasi Swakarsa Mandiri, yang diberikan dengan status hak milik adalah lahan tempat tinggal; untuk lahan usaha, pemerintah memberikan fasilitasi.\nPersoalan sertifikat atau sengketa lahan perorangan perlu diperiksa petugas berdasarkan data Anda.",
                'category' => 'Pertanahan',
                'keywords' => 'hak milik, sertifikat, SHM, status tanah, hak pengelolaan, HPL, lahan usaha, lahan pekarangan',
                'source' => self::UU,
                'source_ref' => 'UU 15/1997: Ps. 23–24, penj. Ps. 24 ayat (3); UU 29/2009: Ps. 13–15, penj. Ps. 14 ayat (1) huruf b',
                'source_url' => self::URL_UU,
            ],
            [
                'title' => 'Peraturan apa saja yang menjadi dasar penyelenggaraan transmigrasi?',
                'body' => "- UU 15/1997 tentang Ketransmigrasian sebagaimana diubah dengan UU 29/2009.\n- PP 19/2024 tentang Peraturan Pelaksanaan UU Ketransmigrasian, sebagaimana diubah dengan PP 37/2025.\n- Perpres 172/2024 tentang Kementerian Transmigrasi.\n- Peraturan Menteri Transmigrasi, misalnya Permentrans 3/2026 tentang Transmigrasi Patriot.\nNaskah UU 15/1997, UU 29/2009, PP 19/2024, PP 37/2025, dan Permentrans 3/2026 dapat diunduh di JDIH Kementerian Transmigrasi (jdih.transmigrasi.go.id).",
                'category' => 'Regulasi',
                'keywords' => 'dasar hukum, undang-undang transmigrasi, peraturan pemerintah, PP 19 2024, regulasi, JDIH',
                'source' => self::JDIH,
                'source_ref' => 'Daftar Peraturan: kategori Peraturan Pemerintah & Undang-Undang; Permentrans 3/2026 (read/987)',
                'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/category/peraturan-pemerintah',
            ],

            // ---------------------------------------------------------------
            // Program unggulan (JDIH Kementerian Transmigrasi)
            // ---------------------------------------------------------------
            [
                'title' => 'Apa itu Program 5T Kementerian Transmigrasi?',
                'body' => "Program 5T adalah lima program unggulan Kementerian Transmigrasi untuk mempercepat penyelesaian masalah, meningkatkan kesejahteraan transmigran, dan membangun kawasan ekonomi baru:\n1. Trans Tuntas: penyelesaian persoalan lahan di kawasan transmigrasi.\n2. Transmigrasi Lokal (Translok): penguatan ekonomi dan infrastruktur masyarakat setempat tanpa perlu berpindah jauh.\n3. Transmigrasi Patriot: kader pembangunan berkeahlian di kawasan transmigrasi.\n4. Trans Karya Nusantara: pengembangan ekonomi berbasis potensi kawasan untuk lapangan kerja berkelanjutan.\n5. Trans Gotong Royong: pembangunan kawasan berbasis kolaborasi pemerintah, masyarakat, dunia usaha, dan organisasi sosial.",
                'category' => 'Program',
                'keywords' => 'program unggulan, 5T, lima program, transformasi transmigrasi',
                'source' => self::JDIH.' — Program Unggulan',
                'source_ref' => 'Program 5T',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
            [
                'title' => 'Apa itu program Trans Tuntas?',
                'body' => 'Trans Tuntas (T²), dengan slogan "Tuntas Lahan, Tuntas Harapan", adalah program penyelesaian menyeluruh atas persoalan lahan di kawasan transmigrasi, seperti sengketa, ketidakjelasan hak, dan konflik agraria. Kegiatannya meliputi pendataan, penyelesaian hukum, sertifikasi, serta revitalisasi dan optimalisasi lahan, agar transmigran memperoleh kepastian hak dan lahan dimanfaatkan secara produktif.',
                'category' => 'Program',
                'keywords' => 'Trans Tuntas, T2, sengketa lahan, konflik agraria, sertifikasi lahan, kepastian hak',
                'source' => self::JDIH.' — Program Unggulan',
                'source_ref' => 'Program 1',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
            [
                'title' => 'Apa itu Transmigrasi Lokal (Translok)?',
                'body' => 'Transmigrasi Lokal (Translok), dengan slogan "Dari Lokal, Maju Global", berfokus pada penguatan ekonomi dan infrastruktur masyarakat setempat tanpa perlu berpindah jauh. Tujuannya membangun kota baru dari desa, mengurangi urbanisasi, dan meningkatkan kesejahteraan melalui pemanfaatan potensi lokal, dengan strategi pengembangan kawasan, revitalisasi infrastruktur, pemberdayaan ekonomi, kolaborasi multipihak, dan integrasi program nasional.',
                'category' => 'Program',
                'keywords' => 'translok, transmigrasi lokal, tanpa pindah jauh, kota baru dari desa',
                'source' => self::JDIH.' — Program Unggulan',
                'source_ref' => 'Program 2',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
            [
                'title' => 'Apa itu Transmigrasi Patriot?',
                'body' => 'Transmigrasi Patriot, dengan slogan "Patriot Berkarya, Bangsa Berjaya", menyiapkan kader pembangunan di kawasan transmigrasi yang memiliki semangat pengabdian, keterampilan yang relevan, dan kemampuan membangun komunitas mandiri. Program ini bertujuan menghadirkan sumber daya manusia unggul yang mampu menyebarkan ilmu pengetahuan dan teknologi untuk mengatasi ketimpangan pembangunan, terutama di wilayah kaya sumber daya yang masih tertinggal. Penyelenggaraannya diatur dalam Peraturan Menteri Transmigrasi Nomor 3 Tahun 2026.',
                'category' => 'Program',
                'keywords' => 'patriot, trans patriot, ekspedisi patriot, kader pembangunan, SDM unggul, Permentrans 3 2026',
                'source' => 'JDIH Kementerian Transmigrasi — Program Unggulan; Permentrans 3/2026',
                'source_ref' => 'Program 3 (beranda JDIH); Konsiderans huruf a–b Permentrans 3/2026',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
            [
                'title' => 'Apa itu program Trans Karya Nusantara?',
                'body' => 'Trans Karya Nusantara, dengan slogan "Kawasan Berkarya, Nusantara Berdaya", mengembangkan ekonomi berbasis potensi kawasan transmigrasi untuk menciptakan lapangan kerja berkelanjutan. Program ini mendorong industri unggulan lokal seperti pertanian, perikanan, pengolahan, dan pariwisata melalui kemitraan dengan dunia usaha, pelatihan SDM, dan pembangunan sentra ekonomi.',
                'category' => 'Program',
                'keywords' => 'Trans Karya Nusantara, lapangan kerja, industri lokal, sentra ekonomi, investasi',
                'source' => self::JDIH.' — Program Unggulan',
                'source_ref' => 'Program 4',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
            [
                'title' => 'Apa itu program Trans Gotong Royong?',
                'body' => 'Trans Gotong Royong (Trans GR), dengan slogan "Bangun Bersama, Sejahtera Semua", adalah pembangunan kawasan transmigrasi berbasis kolaborasi pemerintah, masyarakat, dunia usaha, dan organisasi sosial. Tujuannya mempercepat pembangunan infrastruktur dasar, mendorong kemandirian ekonomi, dan memperkuat harmoni sosial melalui pendekatan multipihak, revitalisasi kawasan, ekonomi kolaboratif, dan pemberdayaan komunitas.',
                'category' => 'Program',
                'keywords' => 'Trans Gotong Royong, Trans GR, kolaborasi, CSR, infrastruktur dasar',
                'source' => self::JDIH.' — Program Unggulan',
                'source_ref' => 'Program 5',
                'source_url' => 'https://jdih.transmigrasi.go.id/',
            ],
        ];
    }
}
