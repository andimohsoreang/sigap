<?php

/**
 * Koreksi 8 artikel Basis Pengetahuan berstatus "ditinjau" hasil cek fakta
 * 30 Oktober 2026 (cek-artikel-2026-10-30.md, di luar repo). Berkas ini
 * menyimpan isi SEBELUM koreksi persis seperti OfficialKnowledgeSeeder lama;
 * isi SESUDAH-nya dibaca dari OfficialKnowledgeSeeder (judul sama).
 *
 * Dipakai `php artisan sigap:koreksi-artikel-resmi`: artikel hanya diperbarui
 * bila isinya masih sama persis dengan versi sebelum (belum disunting petugas)
 * dan statusnya masih "ditinjau".
 */
return [
    'Apa tugas dan fungsi Kementerian Transmigrasi?' => [
        'body' => 'Kementerian Transmigrasi bertugas menyelenggarakan urusan pemerintahan di bidang transmigrasi untuk membantu Presiden. Fungsinya antara lain:
- merumuskan, menetapkan, dan melaksanakan kebijakan pembangunan dan pengembangan kawasan transmigrasi, serta pengembangan ekonomi dan pemberdayaan masyarakat transmigrasi;
- bimbingan teknis dan supervisi urusan kementerian di daerah;
- koordinasi, pembinaan, dan dukungan administrasi di lingkungan kementerian;
- pengelolaan barang milik negara dan pengawasan pelaksanaan tugas di lingkungan kementerian.',
        'source' => 'Perpres 172/2024 tentang Kementerian Transmigrasi',
        'source_ref' => 'Pasal 5',
        'source_url' => 'https://ppid.transmigrasi.go.id/kementerian/tugas-fungsi',
    ],
    'Di mana dan bagaimana cara mendaftar sebagai calon transmigran?' => [
        'body' => 'Pendaftaran dapat dilakukan di:
- kantor desa/kelurahan domisili Anda;
- perangkat daerah kabupaten/kota yang menangani transmigrasi, sesuai penerbit KTP Anda;
- secara daring melalui SIBARDUKTRANS (buat akun dengan nomor telepon, email, dan kata sandi).
Setelah terdaftar, perangkat daerah melakukan seleksi administrasi (pencocokan dokumen identitas dengan data kependudukan) lalu seleksi teknis berupa wawancara, tes tertulis, serta pemeriksaan kesehatan fisik dan mental. Pendaftar yang tidak hadir pada seleksi teknis dianggap mengundurkan diri. Calon yang ditetapkan berhak mengikuti pelatihan.',
        'source' => 'SIBARDUKTRANS — Tata Cara Bertransmigrasi',
        'source_ref' => 'Pendaftaran & Seleksi',
        'source_url' => 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi',
    ],
    'Bantuan apa yang diterima transmigran Transmigrasi Umum?' => [
        'body' => 'Pada Transmigrasi Umum, Pemerintah dan/atau pemerintah daerah memberikan bantuan kepada transmigran, antara lain:
- perbekalan, pengangkutan dari daerah asal, dan penempatan di permukiman transmigrasi;
- sarana produksi sesuai komoditas unggulan kawasan (misalnya pupuk dan benih untuk pertanian, peralatan tangkap untuk perikanan, ternak dan pakan untuk peternakan);
- catu pangan, yaitu bantuan natura dan/atau non-natura untuk meringankan biaya hidup sampai transmigran dapat mulai bekerja atau berusaha;
- tanah untuk transmigran dengan status hak milik.
Jenis dan besaran bantuan secara rinci diatur dalam peraturan pelaksana. Hak bantuan perorangan hanya dapat diperiksa oleh petugas.',
        'source' => 'UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian',
        'source_ref' => 'Pasal 7, Pasal 13 & penjelasannya, Pasal 24 ayat (3)',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang',
    ],
    'Bantuan apa yang diterima transmigran Transmigrasi Swakarsa Berbantuan?' => [
        'body' => 'Menurut penjelasan undang-undang, bantuan pada Transmigrasi Swakarsa Berbantuan diarahkan pada aset produksi tetap untuk meringankan beban kredit transmigran, antara lain:
- pelayanan perpindahan dan penempatan (penampungan, pengangkutan, dan penempatan di permukiman);
- lahan usaha atau sarana usaha sebagai modal kemitraan dengan badan usaha; lahan usaha di areal Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik;
- bimbingan dan perlindungan hubungan kemitraan agar adil, setara, dan saling menguntungkan;
- catu pangan bila pada awal kedatangan transmigran belum berpenghasilan memadai.
Badan usaha mitra membantu transmigran memperoleh akses modal, teknologi, dan manajemen usaha.',
        'source' => 'UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian',
        'source_ref' => 'Pasal 8 & penjelasan Pasal 14',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang',
    ],
    'Apa kewajiban transmigran dan apa sanksinya bila dilanggar?' => [
        'body' => 'Setiap transmigran wajib:
1. bertempat tinggal menetap di permukiman transmigrasi;
2. memelihara kelestarian lingkungan;
3. memelihara dan mengembangkan kegiatan usahanya secara berdaya guna;
4. mempertahankan dan memelihara pemilikan tanah dan aset produksinya;
5. memelihara hubungan yang serasi dengan masyarakat setempat serta menghormati adat istiadatnya; dan
6. mematuhi ketentuan ketransmigrasian.
Transmigran yang tidak melaksanakan kewajiban ini dapat dikenai sanksi administratif berupa teguran lisan, teguran tertulis, atau pencabutan status sebagai transmigran.',
        'source' => 'UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian',
        'source_ref' => 'Pasal 16 & Pasal 35D',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang',
    ],
    'Apakah lahan untuk transmigran diberikan dengan status hak milik?' => [
        'body' => 'Ya. Pemerintah menyediakan tanah bagi penyelenggaraan transmigrasi sesuai rencana tata ruang wilayah. Tanah itu diberikan kepada Pemerintah dengan hak pengelolaan, lalu tanah yang diperuntukkan bagi transmigran diberikan dengan status hak milik. Bila tanah yang akan diberikan dikuasai badan usaha, tanah tersebut lebih dulu diserahkan kepada Pemerintah.
Pada Transmigrasi Swakarsa Berbantuan, lahan usaha di areal Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik; di luar areal itu statusnya mengikuti status asal lahan.
Persoalan sertifikat atau sengketa lahan perorangan perlu diperiksa petugas berdasarkan data Anda.',
        'source' => 'UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian',
        'source_ref' => 'Pasal 23–24 & penjelasan Pasal 14',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang',
    ],
    'Peraturan apa saja yang menjadi dasar penyelenggaraan transmigrasi?' => [
        'body' => '- UU 15/1997 tentang Ketransmigrasian sebagaimana diubah dengan UU 29/2009.
- PP 19/2024 tentang Peraturan Pelaksanaan UU Ketransmigrasian, sebagaimana diubah dengan PP 37/2025. PP 19/2024 menggantikan PP 3/2014.
- Perpres 172/2024 tentang Kementerian Transmigrasi.
- Peraturan Menteri Transmigrasi, misalnya Permentrans 3/2026 tentang Transmigrasi Patriot.
Naskah resmi seluruh peraturan dapat diunduh di JDIH Kementerian Transmigrasi (jdih.transmigrasi.go.id).',
        'source' => 'JDIH Kementerian Transmigrasi',
        'source_ref' => 'Daftar Peraturan',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations',
    ],
    'Apa itu Transmigrasi Patriot?' => [
        'body' => 'Transmigrasi Patriot, dengan slogan "Patriot Berkarya, Bangsa Berjaya", menyiapkan kader pembangunan di kawasan transmigrasi yang memiliki semangat pengabdian, keterampilan yang relevan, dan kemampuan membangun komunitas mandiri. Program ini bertujuan menghadirkan sumber daya manusia unggul yang mampu menyebarkan ilmu pengetahuan dan teknologi untuk mengatasi ketimpangan pembangunan, terutama di wilayah kaya sumber daya yang masih tertinggal. Penyelenggaraannya diatur dalam Peraturan Menteri Transmigrasi Nomor 3 Tahun 2026.',
        'source' => 'Permentrans 3/2026 tentang Transmigrasi Patriot',
        'source_ref' => 'Konsiderans; Program 3',
        'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/read/987',
    ],
];
