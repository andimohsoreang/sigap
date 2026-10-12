<?php

use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\ChatController;
use App\Http\Controllers\Web\MasukController;
use App\Http\Controllers\Web\PengaduanFormController;
use App\Http\Controllers\Web\PublicController;
use App\Http\Controllers\Web\WargaPortalController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SIGAP — Rute Web Publik (Inertia)
|--------------------------------------------------------------------------
| Tampilan lama dipertahankan; data dilayani Service yang sama dengan API.
*/

Route::get('/', [PublicController::class, 'home'])->name('home');
// Halaman pembanding tampilan (gaya absol.id) — halaman asli tidak diubah.
Route::get('/beranda-absol', [PublicController::class, 'homeAbsol'])->name('beranda.absol');
// Panduan lengkap pengaduan & penanganan tiket.
Route::get('/panduan', [PublicController::class, 'guide'])->name('panduan');
Route::get('/tentang', [PublicController::class, 'about'])->name('tentang');
Route::get('/katalog', [PublicController::class, 'catalog'])->name('katalog');
Route::get('/peta', [PublicController::class, 'map'])->name('peta');
Route::get('/lacak', [PublicController::class, 'track'])->name('lacak');
Route::get('/lacak/{ticket}', [PublicController::class, 'track'])
    ->where('ticket', '[A-Za-z0-9-]{1,32}')
    ->name('lacak.show');
Route::post('/lacak/survei', [PublicController::class, 'storeSurvey'])->middleware('throttle:pengaduan')->name('lacak.survei');
Route::get('/pedoman-layanan', [PublicController::class, 'guidelines'])->name('pedoman');
Route::get('/syarat-ketentuan', [PublicController::class, 'terms'])->name('syarat');
Route::get('/kebijakan-privasi', [PublicController::class, 'privacy'])->name('privasi');
Route::get('/tentang-kami', [PublicController::class, 'aboutUs'])->name('tentang-kami');
Route::get('/pengaduan/baru', [PengaduanFormController::class, 'create'])->name('pengaduan');
Route::post('/pengaduan/baru', [PengaduanFormController::class, 'store'])->middleware('throttle:pengaduan')->name('pengaduan.store');
Route::get('/pengaduan/internal', [PengaduanFormController::class, 'createInternal'])->name('pengaduan.internal');
Route::post('/pengaduan/internal', [PengaduanFormController::class, 'storeInternal'])->middleware('throttle:pengaduan')->name('pengaduan.internal.store');

// Alias path lama (04 Okt 2026) — jangan sampai tautan lama 404.
Route::redirect('/lacak-tiket', '/lacak', 301);
Route::post('/lacak-tiket/survei', [PublicController::class, 'storeSurvey'])->middleware('throttle:pengaduan')->name('lacak.survei.legacy');
Route::redirect('/pengaduan', '/pengaduan/baru', 301);
Route::post('/pengaduan', [PengaduanFormController::class, 'store'])->middleware('throttle:pengaduan')->name('pengaduan.store.legacy');

// Login/keluar (NIK/username + kata sandi).
Route::middleware('guest')->group(function () {
    Route::get('/masuk', [MasukController::class, 'create'])->name('masuk');
    Route::post('/masuk', [MasukController::class, 'store']);
});
Route::post('/keluar', [MasukController::class, 'destroy'])->middleware('auth')->name('keluar');

// Live chat publik & warga (PRD D5 — Reverb, fallback polling).
Route::get('/chat/pesan', [ChatController::class, 'index'])->name('chat.index');
Route::post('/chat/pesan', [ChatController::class, 'store'])->middleware('throttle:pengaduan')->name('chat.store');

// Panel Admin — khusus peran admin_kawasan & super_admin.
Route::middleware(['auth', 'role:admin_kawasan,super_admin'])->prefix('admin')->group(function () {
    Route::get('/', [AdminController::class, 'matriks'])->name('admin.dashboard');
    Route::get('/matriks', [AdminController::class, 'matriks'])->name('admin.matriks');

    Route::get('/tiket', [AdminController::class, 'tickets'])->name('admin.tiket');
    Route::get('/tiket/{ticket:ticket_no}', [AdminController::class, 'showTicket'])->name('admin.tiket.show');
    Route::get('/tiket/{ticket:ticket_no}/lampiran', [AdminController::class, 'attachment'])->name('admin.tiket.lampiran');
    Route::post('/tiket/{ticket:ticket_no}/status', [AdminController::class, 'updateStatus'])->name('admin.tiket.status');
    Route::post('/tiket/{ticket:ticket_no}/tanggapan', [AdminController::class, 'reply'])->name('admin.tiket.reply');

    // TECH-SPEC §5: rute kanonik `/admin/tiket-internal`; `/admin/internal` = alias lama.
    Route::get('/tiket-internal', [AdminController::class, 'internal'])->name('admin.tiket-internal');
    Route::redirect('/internal', '/admin/tiket-internal', 301);

    Route::get('/input-manual', [AdminController::class, 'inputManualForm'])->name('admin.input-manual');
    Route::post('/input-manual', [AdminController::class, 'storeManual'])->name('admin.input-manual.store');

    Route::get('/chat', [AdminController::class, 'chat'])->name('admin.chat');
    Route::post('/chat/{conversation}/balas', [AdminController::class, 'sendChat'])->name('admin.chat.reply');

    Route::get('/kawasan', [AdminController::class, 'kawasan'])->name('admin.kawasan');
    Route::post('/kawasan', [AdminController::class, 'storeRegion'])->name('admin.kawasan.store');
    Route::put('/kawasan/{region}', [AdminController::class, 'updateRegion'])->name('admin.kawasan.update');
    Route::delete('/kawasan/{region}', [AdminController::class, 'destroyRegion'])->name('admin.kawasan.destroy');

    Route::get('/kanal', [AdminController::class, 'kanal'])->name('admin.kanal');
    Route::post('/kanal', [AdminController::class, 'storeChannel'])->name('admin.kanal.store');
    Route::post('/integrasi/{channel}', [AdminController::class, 'syncChannel'])->name('admin.integrasi.sync');

    Route::get('/pengaturan', [AdminController::class, 'pengaturan'])->name('admin.pengaturan');
    Route::put('/pengaturan', [AdminController::class, 'updatePengaturan'])->name('admin.pengaturan.update');
    Route::post('/kategori', [AdminController::class, 'storeCategory'])->name('admin.kategori.store');
    Route::delete('/kategori/{category}', [AdminController::class, 'destroyCategory'])->name('admin.kategori.destroy');

    // TECH-SPEC §5: rute kanonik `/admin/petugas` (Daftar Admin); `/admin/admins` = alias lama.
    Route::middleware('role:super_admin')->group(function () {
        Route::get('/petugas', [AdminController::class, 'admins'])->name('admin.petugas');
        Route::post('/petugas', [AdminController::class, 'storeAdmin'])->name('admin.petugas.store');
        Route::get('/log-aktivitas', [AdminController::class, 'activityLog'])->name('admin.log');
    });

    // Alias path lama — hanya super_admin yang boleh (agar tidak membocorkan keberadaan halaman).
    Route::middleware('role:super_admin')->group(function () {
        Route::redirect('/admins', '/admin/petugas', 301);
        Route::post('/admins', [AdminController::class, 'storeAdmin'])->name('admin.petugas.store.legacy');
    });
});

// Portal Warga — khusus peran warga.
Route::middleware(['auth', 'role:warga'])->prefix('portal-warga')->group(function () {
    Route::get('/', [WargaPortalController::class, 'index'])->name('warga.portal');
    Route::patch('/profil', [WargaPortalController::class, 'updateProfile'])->name('warga.profil.update');
    Route::get('/tiket/{ticket:ticket_no}/lampiran', [WargaPortalController::class, 'attachment'])->name('warga.tiket.lampiran');
    Route::delete('/tiket/{ticket:ticket_no}', [WargaPortalController::class, 'destroyTicket'])->name('warga.tiket.destroy');
});