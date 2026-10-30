<?php

/**
 * Kalimat tetap asisten TARA (bukan karangan model) — PRD-AI Tahap 3.
 *
 * Dibaca dengan locale `id` secara eksplisit (AssistantText::get()), terlepas
 * dari APP_LOCALE. Mengubah teks di sini mengubah balasan ke warga: tes
 * rekaman tests/Feature/Assistant/ReplyGoldenTest wajib ikut diperbarui
 * atas persetujuan pemilik.
 */
return [
    // Serah ke petugas
    'ai_gagal' => 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.',
    'diteruskan' => 'Pesan Anda kami teruskan ke petugas beserta ringkasannya. Mohon tunggu, petugas akan membalas di percakapan ini.',
    'minta_kontak' => 'Saat ini di luar jam layanan petugas (:jam). Pesan Anda sudah kami catat dengan nomor referensi :referensi. Tinggalkan nomor WhatsApp atau surel agar petugas dapat menghubungi Anda pada hari kerja berikutnya.',
    'kompleks' => 'Pertanyaan ini perlu ditelaah lebih lanjut terhadap keadaan Anda, jadi saya teruskan ke petugas beserta ringkasannya.',
    'sumber_berbeda' => 'Sumber resmi yang saya temukan berbeda, dan belum dapat dipastikan mana yang berlaku. Pertanyaan Anda saya teruskan ke petugas untuk dipastikan.',
    'angka_tanpa_dasar' => 'Saya belum dapat memastikan jawaban untuk pertanyaan ini dari sumber resmi, jadi pertanyaan Anda saya teruskan ke petugas.',

    // Aduan & urusan pribadi
    'tanya_detail' => 'Baik, saya bantu. Ceritakan masalahnya: apa yang terjadi, di kawasan atau SP mana, dan sejak kapan? Bila ada, sebutkan juga dampaknya.',
    'aduan_diringkas' => 'Terima kasih. Laporan Anda saya ringkas untuk petugas agar bisa langsung ditindaklanjuti.',
    'aduan_ringkasan' => 'Ringkasan: :ringkasan',
    'pribadi_bersumber' => 'Untuk memastikan apakah ketentuan di atas berlaku pada kasus Anda, perlu diperiksa langsung oleh petugas. Saya tidak dapat memastikannya.',
    'pribadi_tanpa_sumber' => 'Pertanyaan ini menyangkut data Anda pribadi, jadi perlu diperiksa langsung oleh petugas. Saya tidak dapat memastikannya.',

    // Jawaban tanpa model atau tanpa sumber
    'tidak_jelas' => 'Mohon maaf, saya belum dapat memahami pesan Bapak/Ibu dengan baik. Bisakah pertanyaannya disampaikan dalam Bahasa Indonesia? Bapak/Ibu juga dapat langsung berbicara dengan petugas.',
    'di_luar_layanan' => 'Mohon maaf, saya hanya dapat membantu informasi seputar layanan Kementerian Transmigrasi.',
    'tidak_tahu' => 'Maaf, saya belum menemukan informasi resmi untuk pertanyaan tersebut, jadi saya tidak akan menebak. Anda dapat menanyakannya langsung ke petugas.',
    'kebijakan_tanpa_sumber' => 'Pertanyaan ini menyangkut kebijakan Kementerian Transmigrasi. Saya belum menemukan sumber resmi yang membahasnya, jadi saya tidak akan berspekulasi. Untuk pernyataan resmi atau data kinerja program, Bapak/Ibu dapat mengajukan permohonan informasi publik ke PPID Kementerian Transmigrasi atau menghubungi Humas Kementerian.',
    'portal_tersedia' => 'Layanan ini tersedia di :portal: :kegunaan.',

    // Rujukan portal
    'rujukan' => 'Masalah ini ditangani langsung oleh :portal. Saya sudah menyiapkan pengantar berisi langkah, hal yang perlu disiapkan, dan ringkasan aduan Anda.',
    'rujukan_pendamping' => ':nama dari SIGAP mendampingi Anda sampai aduan tercatat.',
    'portal_gangguan' => ':portal sedang tidak dapat diakses. Pesan Anda kami teruskan ke petugas agar tetap dapat dibantu.',

    // Menunggu petugas
    'menunggu_petugas' => 'Pesan Anda sudah masuk ke petugas dan akan dibalas di percakapan ini. Sambil menunggu, Anda tetap bisa bertanya hal umum seputar transmigrasi kepada saya.',
    'menunggu_petugas_luar_jam' => 'Pesan Anda sudah masuk ke petugas dan akan dibalas pada jam layanan (:jam). Sambil menunggu, Anda tetap bisa bertanya hal umum seputar transmigrasi kepada saya.',

    // Status tiket
    'tiket_tidak_ditemukan' => 'Tiket :nomor tidak ditemukan. Periksa kembali nomornya. Tiket bernomor format lama memerlukan kode akses di halaman Lacak Tiket.',
    'tiket_status' => 'Status tiket :nomor: :status.',
];
