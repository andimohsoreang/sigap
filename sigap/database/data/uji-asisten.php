<?php

/**
 * Paket uji Asisten SIGAP: pertanyaan bergaya warga beserta harapannya.
 *
 * - jenis   : klasifikasi yang diharapkan dari model (informasi, aduan,
 *             pribadi, lainnya, tidak_jelas).
 * - artikel : potongan judul artikel yang WAJIB masuk 3 besar hasil
 *             pencarian; null berarti pencarian TIDAK boleh menemukan
 *             artikel apa pun (agar AI tidak tergoda menebak); false
 *             berarti hasil pencarian tidak dinilai (aduan/hak pribadi
 *             tetap diteruskan ke petugas apa pun sumbernya).
 *
 * Dipakai oleh tests/Feature/Ai/RetrievalQualityTest (pencarian, tanpa
 * model) dan `php artisan sigap:uji-asisten` (alur lengkap dengan model).
 * Tambahkan kasus dari pertanyaan nyata yang gagal dijawab.
 */
return [
    // Layanan informasi publik (PPID)
    ['tanya' => 'Bagaimana cara minta data atau dokumen dari kementerian transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'meminta informasi publik dari'],
    ['tanya' => 'berapa hari permohonan informasi saya dijawab?', 'jenis' => 'informasi', 'artikel' => 'Berapa lama permohonan informasi'],
    ['tanya' => 'minta salinan dokumen bayar nggak?', 'jenis' => 'informasi', 'artikel' => 'dikenai biaya'],
    ['tanya' => 'Permohonan informasi saya ditolak, saya mau banding', 'jenis' => 'informasi', 'artikel' => 'ditolak atau tidak dijawab'],
    ['tanya' => 'tidak puas dengan keputusan atasan PPID, lalu ke mana?', 'jenis' => 'informasi', 'artikel' => 'tidak puas dengan keputusan Atasan PPID'],
    ['tanya' => 'cara cek status permohonan informasi di ppid', 'jenis' => 'informasi', 'artikel' => 'melacak status permohonan informasi'],
    ['tanya' => 'informasi apa saja yang rahasia dan tidak boleh dibuka?', 'jenis' => 'informasi', 'artikel' => 'dikecualikan'],
    ['tanya' => 'jam buka kantor ppid dan nomor teleponnya berapa?', 'jenis' => 'informasi', 'artikel' => 'jam layanan'],
    ['tanya' => 'alamat kantor kementerian transmigrasi di mana?', 'jenis' => 'informasi', 'artikel' => 'jam layanan'],
    ['tanya' => 'Siapa atasan PPID di Kementrans?', 'jenis' => 'informasi', 'artikel' => 'Apa itu PPID'],
    ['tanya' => 'Ada pejabat minta pungli, saya mau lapor penyalahgunaan wewenang', 'jenis' => 'aduan', 'artikel' => 'penyalahgunaan wewenang'],

    // Ketentuan pokok ketransmigrasian
    ['tanya' => 'Apa saja syarat untuk menjadi peserta program transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran'],
    ['tanya' => 'gimana caranya daftar jadi transmigran?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran'],
    ['tanya' => 'Nuwun sewu, kulo badhe nderek transmigrasi, syaratipun menapa?', 'jenis' => 'informasi', 'artikel' => 'boleh menjadi transmigran'],
    ['tanya' => 'umur berapa batas maksimal untuk ikut transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'persyaratan calon transmigran'],
    ['tanya' => 'saya belum menikah, boleh ikut transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'persyaratan calon transmigran'],
    ['tanya' => 'daftar transmigrasi bisa di kantor desa?', 'jenis' => 'informasi', 'artikel' => 'cara mendaftar sebagai calon transmigran'],
    ['tanya' => 'seleksi calon transmigran ada tes kesehatan?', 'jenis' => 'informasi', 'artikel' => 'cara mendaftar sebagai calon transmigran'],
    ['tanya' => 'warga setempat di SP Pugar bisa jadi transmigran?', 'jenis' => 'informasi', 'artikel' => 'transmigran lokal'],
    ['tanya' => 'apa bedanya transmigrasi umum dan swakarsa mandiri?', 'jenis' => 'informasi', 'artikel' => 'jenis transmigrasi'],
    ['tanya' => 'transmigrasi itu artinya apa sih?', 'jenis' => 'informasi', 'artikel' => 'yang dimaksud dengan transmigrasi'],
    ['tanya' => 'siapa yang diprioritaskan ikut transmigrasi umum?', 'jenis' => 'informasi', 'artikel' => 'diutamakan'],
    ['tanya' => 'korban bencana apakah diutamakan untuk transmigrasi?', 'jenis' => 'informasi', 'artikel' => 'diutamakan'],
    ['tanya' => 'tahapan seleksi dan pelatihan calon transmigran seperti apa?', 'jenis' => 'informasi', 'artikel' => 'seleksi, pelatihan'],
    ['tanya' => 'transmigran dapat bantuan apa saja dari pemerintah?', 'jenis' => 'informasi', 'artikel' => 'Bantuan apa yang diterima transmigran'],
    ['tanya' => 'apakah transmigran umum dapat jatah hidup atau catu pangan?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Umum?'],
    ['tanya' => 'kalau transmigrasi mandiri dibantu apa?', 'jenis' => 'informasi', 'artikel' => 'Swakarsa Mandiri?'],
    ['tanya' => 'kemitraan dengan perusahaan di transmigrasi swakarsa berbantuan', 'jenis' => 'informasi', 'artikel' => 'Swakarsa Berbantuan?'],
    ['tanya' => 'apa kewajiban seorang transmigran?', 'jenis' => 'informasi', 'artikel' => 'kewajiban transmigran'],
    ['tanya' => 'kalau transmigran meninggalkan lokasi apa sanksinya?', 'jenis' => 'informasi', 'artikel' => 'kewajiban transmigran'],
    ['tanya' => 'tanah transmigran statusnya hak milik bukan?', 'jenis' => 'informasi', 'artikel' => 'status hak milik'],
    ['tanya' => 'dasar hukum transmigrasi apa saja?', 'jenis' => 'informasi', 'artikel' => 'dasar penyelenggaraan transmigrasi'],
    ['tanya' => 'tugas kementerian transmigrasi itu apa?', 'jenis' => 'informasi', 'artikel' => 'tugas dan fungsi'],

    // Program unggulan
    ['tanya' => 'apa itu program 5T?', 'jenis' => 'informasi', 'artikel' => 'Program 5T'],
    ['tanya' => 'program untuk menyelesaikan sengketa lahan transmigrasi apa?', 'jenis' => 'informasi', 'artikel' => 'Trans Tuntas'],
    ['tanya' => 'translok itu apa?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Lokal'],
    ['tanya' => 'transmigrasi patriot itu program apa?', 'jenis' => 'informasi', 'artikel' => 'Transmigrasi Patriot'],
    ['tanya' => 'Trans Gotong Royong tujuannya apa?', 'jenis' => 'informasi', 'artikel' => 'Trans Gotong Royong'],

    // Layanan SIGAP (KnowledgeSeeder)
    ['tanya' => 'bagaimana cara membuat pengaduan di sigap?', 'jenis' => 'informasi', 'artikel' => 'membuat pengaduan di SIGAP'],
    ['tanya' => 'cara lacak tiket pengaduan saya', 'jenis' => 'informasi', 'artikel' => 'melacak tiket'],

    // Harus diteruskan ke petugas / tidak boleh dijawab dari artikel
    ['tanya' => 'Jalan poros di kawasan transmigrasi kami rusak parah sejak Juli, mohon ditindaklanjuti', 'jenis' => 'aduan', 'artikel' => false],
    ['tanya' => 'Sertifikat lahan saya belum keluar padahal sudah 10 tahun, kenapa?', 'jenis' => 'pribadi', 'artikel' => false],
    ['tanya' => 'Buatkan saya pantun lucu tentang kucing', 'jenis' => 'lainnya', 'artikel' => null],
    ['tanya' => 'Siapa juara piala dunia 2022?', 'jenis' => 'lainnya', 'artikel' => null],
    ['tanya' => 'resep rendang padang yang enak', 'jenis' => 'lainnya', 'artikel' => null],
];
