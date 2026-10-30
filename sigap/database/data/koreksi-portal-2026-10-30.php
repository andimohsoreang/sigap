<?php

/**
 * Koreksi katalog portal (30 Oktober 2026): `purpose`/`description` tidak boleh
 * memuat ketentuan aturan (PRD-AI FR-AI-12). Isi SEBELUM koreksi persis seperti
 * PortalSeeder lama; isi SESUDAH dibaca dari PortalSeeder (kode sama).
 * Dipakai `php artisan sigap:koreksi-portal`.
 */
return [
    'persyaratan-transmigrasi' => [
        'purpose' => 'Syarat menjadi transmigran: WNI ber-KTP, sudah berkeluarga, usia 19–49 tahun, sehat, punya sertifikat pelatihan, belum pernah bertransmigrasi, dan lulus seleksi',
    ],
    'ppid' => [
        'description' => 'Layanan keterbukaan informasi publik sesuai UU 14/2008.',
    ],
    'pengaduan-wewenang' => [
        'description' => 'Pengaduan diterima PPID (datang langsung, email, formulir, atau kotak pengaduan) lalu diteruskan ke Menteri dan Inspektur Jenderal, paling lambat 30 hari kerja.',
    ],
];
