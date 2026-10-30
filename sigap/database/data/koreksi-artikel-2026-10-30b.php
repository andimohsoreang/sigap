<?php

/**
 * Koreksi kedua artikel resmi "ditinjau" (30 Oktober 2026), terverifikasi dari
 * naskah Permentrans 2/2024 (JDIH Kementerian Transmigrasi, read/814):
 * - persyaratan TKN: tambah sertifikat pelatihan (Pasal 6 ayat (3) huruf f)
 *   dan kata kunci syarat peserta;
 * - transmigran lokal: Pasal 9 ayat (3) tidak merujuk Pasal 6 dan tidak
 *   mengatur usia, jadi kalimat usia dihapus; dasar hukum diisi.
 *
 * Isi SEBELUM koreksi (hanya kolom yang dikoreksi); SESUDAH-nya dibaca dari
 * OfficialKnowledgeSeeder. Dipakai `sigap:koreksi-artikel-resmi
 * --berkas=koreksi-artikel-2026-10-30b`.
 */
return [
    'Apa saja persyaratan calon transmigran dari daerah asal?' => [
        'body' => 'Persyaratan calon Transmigran Karya Nusantara (TKN) daerah asal:
1. Warga negara Indonesia yang memiliki KTP-el.
2. Berkeluarga, dibuktikan dengan surat nikah dan KK. Boleh belum berkeluarga bila memiliki keahlian tertentu yang dibuktikan sertifikat (mis. tenaga kesehatan, tenaga pendidikan, jasa konstruksi, perbengkelan, las, kerajinan, pengolahan hasil pertanian).
3. Berusia 19–53 tahun (48–53 tahun bagi purnabakti TNI/Polri).
4. Diutamakan minimal lulusan SMP/sederajat.
5. Sehat, dibuktikan surat keterangan dokter.
6. Menyatakan tekad mengembangkan kehidupan di permukiman transmigrasi dengan surat pernyataan.
7. Belum pernah bertransmigrasi, dibuktikan surat keterangan perangkat daerah bidang ketransmigrasian.
8. Mengikuti seleksi dan pelatihan komponen cadangan (Komcad), dan lulus seleksi.',
        'keywords' => 'syarat transmigran, persyaratan calon transmigran, usia transmigran, umur, KTP, KK, surat nikah, surat sehat, belum berkeluarga, lajang, TKN, Komcad',
    ],
    'Apa syarat penduduk setempat untuk menjadi transmigran lokal?' => [
        'body' => 'Penduduk yang tinggal di Satuan Permukiman (SP) Pugar dapat memperoleh perlakuan sebagai transmigran, baik yang memiliki tanah dan rumah, memiliki tanah tanpa rumah, maupun tidak memiliki keduanya. Syaratnya:
1. Terdaftar dalam dokumen RTSP-Pugar.
2. Memiliki KTP di permukiman yang akan dikembangkan menjadi SP-Pugar tersebut.
3. Berkeluarga.
4. Sudah tinggal menetap dan memanfaatkan tanah di permukiman itu paling singkat 2 tahun.
5. Berusia 19–53 tahun, diutamakan minimal lulusan SMP/sederajat, dan sehat (surat keterangan dokter).
6. Membuat surat pernyataan tekad, belum pernah bertransmigrasi, dan lulus seleksi.',
        'dasar_hukum' => null,
        'tanggal_dasar' => null,
        'status_dasar' => 'belum_diketahui',
    ],
];
