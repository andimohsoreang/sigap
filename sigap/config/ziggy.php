<?php

/*
|--------------------------------------------------------------------------
| Ziggy — rute yang diekspos ke JavaScript (A-14)
|--------------------------------------------------------------------------
| Ziggy menanam daftar rute ke setiap halaman HTML. Agar struktur panel admin
| & portal warga tidak bocor ke pengunjung publik, app.blade.php SELALU
| memanggil `@routes($ziggyGroups)` dengan grup sesuai peran pengguna:
|   - tamu / umum  → ['public']
|   - warga        → ['public', 'warga']
|   - admin        → ['public', 'admin']
| Catatan: bila grup diberikan, Ziggy mengabaikan 'except' di bawah. 'except'
| tetap diisi sebagai jaring pengaman untuk `php artisan ziggy:generate`.
*/

return [
    'groups' => [
        'public' => [
            'home',
            'beranda.standar',
            'panduan',
            'tentang',
            'tentang-kami',
            'katalog',
            'peta',
            'lacak',
            'lacak.show',
            'lacak.survei',
            'pedoman',
            'syarat',
            'privasi',
            'pengaduan',
            'pengaduan.store',
            'pengaduan.internal',
            'pengaduan.internal.store',
            'masuk',
            'masuk.store',
            'keluar',
            'chat.index',
            'chat.store',
        ],
        'warga' => ['warga.*'],
        'admin' => ['admin.*', '!admin.*.legacy'],
    ],

    'except' => [
        'admin.*',
        'warga.*',
        '*.legacy',
        'sanctum.*',
        'storage.*',
        'ignition.*',
    ],
];
