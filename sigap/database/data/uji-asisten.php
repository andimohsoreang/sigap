<?php

/**
 * Paket uji Asisten SIGAP: pertanyaan bergaya warga beserta harapannya.
 *
 * - jenis   : klasifikasi yang diharapkan dari model (informasi, aduan,
 *             pribadi, lainnya, tidak_jelas).
 * - artikel : potongan judul artikel yang WAJIB masuk 3 besar hasil
 *             pencarian artikel; null berarti pencarian TIDAK boleh
 *             menemukan artikel apa pun (agar AI tidak tergoda menebak);
 *             false berarti hasil pencarian tidak dinilai (aduan/hak
 *             pribadi tetap diteruskan ke petugas apa pun sumbernya).
 *             Dipakai metrik "artikel saja".
 * - harus_memuat : frasa fakta yang WAJIB ada di salah satu dari 3 sumber
 *             teratas TARA (judul/isi artikel atau kutipan Sumber Resmi),
 *             tanpa membedakan huruf besar/kecil, spasi, dan jenis tanda
 *             hubung ("19 - 53" = "19–53"). Isinya fakta jawaban yang BENAR
 *             dari teks resmi (artikel Basis Pengetahuan DAN naskah Sumber
 *             Resmi bila memuatnya) — bukan frasa yang kebetulan sudah
 *             ditemukan sistem, dan jangan mengarang. Kasus yang belum
 *             ditemukan dicatat di RetrievalQualityTest::DIKETAHUI_GAGAL.
 *             null/false: sama seperti `artikel`.
 * - portal  : (opsional) kode portal yang wajib dipilih model (rujukan),
 *             mis. keluhan sertifikat lahan → Trans Tuntas.
 * - konflik : (opsional) dua angka yang ditulis berbeda oleh dua Sumber Resmi
 *             (PRD-AI FR-AI-11). Bila label dasar hukum sumbernya memutuskan,
 *             jawaban wajib memuat angka yang berlaku dan menyebut angka lama
 *             sebagai aturan yang sudah diganti; bila tidak, percakapan wajib
 *             diteruskan ke petugas dengan alasan "sumber berbeda".
 *
 * Dipakai oleh tests/Feature/Ai/RetrievalQualityTest (pencarian, tanpa
 * model) dan `php artisan sigap:uji-asisten` (alur lengkap dengan model).
 * Tambahkan kasus dari pertanyaan nyata yang gagal dijawab.
 */
return [
    // Layanan informasi publik (PPID)
    ['tanya' => 'Bagaimana cara minta data atau dokumen dari kementerian transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'meminta informasi publik dari', 'harus_memuat' => 'formulir permohonan informasi'],
    ['tanya' => 'berapa hari permohonan informasi saya dijawab?', 'jenis' => 'informasi', 'artikel' => 'Berapa lama permohonan informasi', 'harus_memuat' => 'paling lambat 10'],
    ['tanya' => 'minta salinan dokumen bayar nggak?', 'jenis' => 'informasi', 'artikel' => 'dikenai biaya', 'harus_memuat' => 'tidak dipungut biaya'],
    ['tanya' => 'Permohonan informasi saya ditolak, saya mau banding', 'jenis' => 'informasi', 'artikel' => 'ditolak atau tidak dijawab', 'harus_memuat' => 'keberatan'],
    ['tanya' => 'tidak puas dengan keputusan atasan PPID, lalu ke mana?', 'jenis' => 'informasi', 'artikel' => 'tidak puas dengan keputusan Atasan PPID', 'harus_memuat' => 'komisi informasi'],
    ['tanya' => 'cara cek status permohonan informasi di ppid', 'jenis' => 'informasi', 'artikel' => 'melacak status permohonan informasi', 'harus_memuat' => 'cek status'],
    ['tanya' => 'informasi apa saja yang rahasia dan tidak boleh dibuka?', 'jenis' => 'informasi', 'artikel' => 'dikecualikan', 'harus_memuat' => 'dikecualikan'],
    ['tanya' => 'jam buka kantor ppid dan nomor teleponnya berapa?', 'jenis' => 'informasi', 'artikel' => 'jam layanan', 'harus_memuat' => '021-7994372'],
    ['tanya' => 'alamat kantor kementerian transmigrasi di mana?', 'jenis' => 'informasi', 'artikel' => 'jam layanan', 'harus_memuat' => 'kalibata'],
    ['tanya' => 'Siapa atasan PPID di Kementrans?', 'jenis' => 'informasi', 'artikel' => 'Apa itu PPID', 'harus_memuat' => 'sekretaris jenderal'],
    ['tanya' => 'Ada pejabat minta pungli, saya mau lapor penyalahgunaan wewenang', 'jenis' => 'aduan', 'artikel' => 'penyalahgunaan wewenang', 'harus_memuat' => 'inspektur jenderal'],

    // Ketentuan pokok ketransmigrasian
    ['tanya' => 'Apa saja syarat untuk menjadi peserta program transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran', 'harus_memuat' => 'KTP-el'],
    ['tanya' => 'gimana caranya daftar jadi transmigran?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran', 'harus_memuat' => 'kantor desa'],
    ['tanya' => 'Nuwun sewu, kulo badhe nderek transmigrasi, syaratipun menapa?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran', 'harus_memuat' => '19 - 53 tahun'],
    ['tanya' => 'umur berapa batas maksimal untuk ikut transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'persyaratan calon transmigran', 'harus_memuat' => '53 tahun', 'konflik' => ['berlaku' => '53', 'lama' => '49']],
    ['tanya' => 'saya belum menikah, boleh ikut transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'persyaratan calon transmigran', 'harus_memuat' => 'belum berkeluarga'],
    ['tanya' => 'daftar transmigrasi bisa di kantor desa?', 'jenis' => 'informasi', 'artikel' => 'cara mendaftar sebagai calon transmigran', 'harus_memuat' => 'kantor desa'],
    ['tanya' => 'seleksi calon transmigran ada tes kesehatan?', 'jenis' => 'informasi', 'artikel' => 'cara mendaftar sebagai calon transmigran', 'harus_memuat' => 'pemeriksaan kesehatan'],
    ['tanya' => 'warga setempat di SP Pugar bisa jadi transmigran?', 'jenis' => 'informasi', 'artikel' => 'transmigran lokal', 'harus_memuat' => 'sp-pugar'],
    ['tanya' => 'apa bedanya transmigrasi umum dan swakarsa mandiri?', 'jenis' => 'informasi', 'artikel' => 'jenis transmigrasi', 'harus_memuat' => 'telah memiliki kemampuan'],
    ['tanya' => 'transmigrasi itu artinya apa sih?', 'jenis' => 'informasi', 'artikel' => 'yang dimaksud dengan transmigrasi', 'harus_memuat' => 'perpindahan penduduk secara sukarela'],
    ['tanya' => 'siapa yang diprioritaskan ikut transmigrasi umum?', 'jenis' => 'informasi', 'artikel' => 'diutamakan', 'harus_memuat' => 'kepadatan penduduk'],
    ['tanya' => 'korban bencana apakah diutamakan untuk transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'diutamakan', 'harus_memuat' => 'bencana alam'],
    ['tanya' => 'tahapan seleksi dan pelatihan calon transmigran seperti apa?', 'jenis' => 'informasi', 'artikel' => 'seleksi, pelatihan', 'harus_memuat' => 'pendidikan dan pelatihan'],
    ['tanya' => 'transmigran dapat bantuan apa saja dari pemerintah?', 'jenis' => 'informasi', 'artikel' => 'Bantuan apa yang diterima transmigran', 'harus_memuat' => 'sarana produksi'],
    ['tanya' => 'apakah transmigran umum dapat jatah hidup atau catu pangan?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Umum?', 'harus_memuat' => 'biaya hidup'],
    ['tanya' => 'kalau transmigrasi mandiri dibantu apa?', 'jenis' => 'informasi', 'artikel' => 'Swakarsa Mandiri?', 'harus_memuat' => 'pengurusan perpindahan'],
    ['tanya' => 'kemitraan dengan perusahaan di transmigrasi swakarsa berbantuan', 'jenis' => 'informasi', 'artikel' => 'Swakarsa Berbantuan?', 'harus_memuat' => 'mitra usaha'],
    ['tanya' => 'apa kewajiban seorang transmigran?', 'jenis' => 'informasi', 'artikel' => 'kewajiban transmigran', 'harus_memuat' => 'bertempat tinggal menetap'],
    ['tanya' => 'kalau transmigran meninggalkan lokasi apa sanksinya?', 'jenis' => 'informasi', 'artikel' => 'kewajiban transmigran', 'harus_memuat' => 'pencabutan status'],
    ['tanya' => 'tanah transmigran statusnya hak milik bukan?', 'jenis' => 'informasi', 'artikel' => 'status hak milik', 'harus_memuat' => 'status hak milik'],
    ['tanya' => 'dasar hukum transmigrasi apa saja?', 'jenis' => 'informasi', 'artikel' => 'dasar penyelenggaraan transmigrasi', 'harus_memuat' => '15/1997'],
    ['tanya' => 'tugas kementerian transmigrasi itu apa?', 'jenis' => 'informasi', 'artikel' => 'tugas dan fungsi', 'harus_memuat' => 'urusan pemerintahan di bidang transmigrasi'],

    // Program unggulan
    ['tanya' => 'apa itu program 5T?', 'jenis' => 'informasi', 'artikel' => 'Program 5T', 'harus_memuat' => 'lima program'],
    ['tanya' => 'program untuk menyelesaikan sengketa lahan transmigrasi apa?', 'jenis' => 'informasi', 'artikel' => 'Trans Tuntas', 'harus_memuat' => 'trans tuntas'],
    ['tanya' => 'translok itu apa?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Lokal', 'harus_memuat' => 'tanpa perlu berpindah jauh'],
    ['tanya' => 'transmigrasi patriot itu program apa?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Patriot', 'harus_memuat' => 'kader pembangunan'],
    ['tanya' => 'Trans Gotong Royong tujuannya apa?', 'jenis' => 'informasi', 'artikel' => 'Trans Gotong Royong', 'harus_memuat' => 'harmoni sosial'],

    // Layanan SIGAP (KnowledgeSeeder)
    ['tanya' => 'bagaimana cara membuat pengaduan di sigap?', 'jenis' => 'informasi', 'artikel' => 'membuat pengaduan di SIGAP', 'harus_memuat' => 'buat pengaduan'],
    ['tanya' => 'cara lacak tiket pengaduan saya', 'jenis' => 'informasi', 'artikel' => 'melacak tiket', 'harus_memuat' => 'lacak tiket'],

    // Harus diteruskan ke petugas / tidak boleh dijawab dari artikel
    ['tanya' => 'Jalan poros di kawasan transmigrasi kami rusak parah sejak Juli, mohon ditindaklanjuti', 'jenis' => 'aduan', 'artikel' => false, 'harus_memuat' => false],
    ['tanya' => 'Sertifikat lahan saya belum keluar padahal sudah 10 tahun, kenapa?', 'jenis' => 'aduan', 'portal' => 'trans-tuntas', 'artikel' => false, 'harus_memuat' => false],
    ['tanya' => 'Buatkan saya pantun lucu tentang kucing', 'jenis' => 'lainnya', 'artikel' => null, 'harus_memuat' => null],
    ['tanya' => 'Siapa juara piala dunia 2022?', 'jenis' => 'lainnya', 'artikel' => null, 'harus_memuat' => null],
    ['tanya' => 'resep rendang padang yang enak', 'jenis' => 'lainnya', 'artikel' => null, 'harus_memuat' => null],
];
