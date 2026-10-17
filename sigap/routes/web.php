<?php

use App\Http\Controllers\Web\AdminController;
use App\Http\Controllers\Web\ChatController;
use App\Http\Controllers\Web\ContactCenterController;
use App\Http\Controllers\Web\KnowledgeController;
use App\Http\Controllers\Web\KnowledgeDocumentController;
use App\Http\Controllers\Web\MasukController;
use App\Http\Controllers\Web\PengaduanFormController;
use App\Http\Controllers\Web\PortalController;
use App\Http\Controllers\Web\PublicController;
use App\Http\Controllers\Web\ReferralController;
use App\Http\Controllers\Web\ReferralPublicController;
use App\Http\Controllers\Web\WargaPortalController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SIGAP — Rute Web Publik (Inertia)
|--------------------------------------------------------------------------
| Tampilan lama dipertahankan; data dilayani Service yang sama dengan API.
*/

// Beranda utama memakai tampilan gaya absol.id (keputusan 12 Okt 2026).
Route::get('/', [PublicController::class, 'home'])->name('home');
// Tampilan beranda lama tetap tersedia sebagai pembanding.
Route::get('/beranda-standar', [PublicController::class, 'homeStandard'])->name('beranda.standar');
// Alamat lama versi absol diarahkan ke beranda utama agar tautan lama tidak 404.
Route::redirect('/beranda-absol', '/', 301);
// Panduan lengkap pengaduan & penanganan tiket.
Route::get('/panduan', [PublicController::class, 'guide'])->name('panduan');
Route::get('/tentang', [PublicController::class, 'about'])->name('tentang');
Route::get('/katalog', [PublicController::class, 'catalog'])->name('katalog');
Route::get('/peta', [PublicController::class, 'map'])->name('peta');
// Lacak tiket publik dibatasi limiter 'lookup' (anti-enumerasi nomor tiket).
Route::get('/lacak', [PublicController::class, 'track'])->middleware('throttle:lookup')->name('lacak');
Route::get('/lacak/{ticket}', [PublicController::class, 'track'])
    ->where('ticket', '[A-Za-z0-9-]{1,32}')
    ->middleware('throttle:lookup')
    ->name('lacak.show');
Route::post('/lacak/survei', [PublicController::class, 'storeSurvey'])->middleware(['throttle:lookup', 'throttle:pengaduan'])->name('lacak.survei');
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
Route::post('/lacak-tiket/survei', [PublicController::class, 'storeSurvey'])->middleware(['throttle:lookup', 'throttle:pengaduan'])->name('lacak.survei.legacy');
Route::redirect('/pengaduan', '/pengaduan/baru', 301);
Route::post('/pengaduan', [PengaduanFormController::class, 'store'])->middleware('throttle:pengaduan')->name('pengaduan.store.legacy');

// Login/keluar (NIK/username + kata sandi).
Route::middleware('guest')->group(function () {
    Route::get('/masuk', [MasukController::class, 'create'])->name('masuk');
    // A-01: login web dibatasi limiter 'login' (identifier+IP & per IP).
    Route::post('/masuk', [MasukController::class, 'store'])->middleware('throttle:login')->name('masuk.store');
});
Route::post('/keluar', [MasukController::class, 'destroy'])->middleware('auth')->name('keluar');

// Live chat publik & warga (PRD D5 — Reverb, fallback polling).
// Tamu wajib mengisi nama dulu (POST /chat/mulai); warga login memakai akunnya.
Route::get('/chat/pesan', [ChatController::class, 'index'])->middleware('throttle:chat-baca')->name('chat.index');
Route::post('/chat/mulai', [ChatController::class, 'start'])->middleware('throttle:chat-mulai')->name('chat.start');
Route::post('/chat/pesan', [ChatController::class, 'store'])->middleware('throttle:chat')->name('chat.store');
// Contact center (asisten AI): minta petugas, tinggalkan kontak, nilai jawaban.
Route::post('/chat/petugas', [ChatController::class, 'handoff'])->middleware('throttle:chat')->name('chat.handoff');
Route::post('/chat/kontak', [ChatController::class, 'contact'])->middleware('throttle:chat')->name('chat.contact');
Route::post('/chat/pesan/{message}/nilai', [ChatController::class, 'feedback'])->whereNumber('message')->middleware('throttle:chat')->name('chat.feedback');

// Pengantar rujukan portal (tanpa login; token acak di URL).
Route::get('/rujukan/{token}', [ReferralPublicController::class, 'show'])->middleware('throttle:lookup')->name('rujukan.show');
Route::post('/rujukan/{token}/buka', [ReferralPublicController::class, 'open'])->middleware('throttle:lookup')->name('rujukan.open');
Route::post('/rujukan/{token}/berhasil', [ReferralPublicController::class, 'confirm'])->middleware('throttle:chat')->name('rujukan.confirm');
Route::post('/rujukan/{token}/bantuan', [ReferralPublicController::class, 'help'])->middleware('throttle:chat')->name('rujukan.help');

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
    Route::post('/chat/{conversation}/baca', [AdminController::class, 'readChat'])->name('admin.chat.read');
    Route::get('/chat/belum-dibaca', [AdminController::class, 'chatUnread'])->name('admin.chat.unread');
    Route::post('/chat/{conversation}/ambil', [ContactCenterController::class, 'take'])->name('admin.chat.take');
    Route::post('/chat/{conversation}/tutup', [ContactCenterController::class, 'close'])->name('admin.chat.close');
    Route::post('/chat/{conversation}/rujuk', [ContactCenterController::class, 'refer'])->name('admin.chat.refer');

    // Rujukan portal: penanggung jawab mendampingi warga sampai berhasil.
    Route::get('/rujukan', [ReferralController::class, 'index'])->name('admin.rujukan');
    Route::post('/rujukan/{referral}/catatan', [ReferralController::class, 'note'])->name('admin.rujukan.catatan');
    Route::post('/rujukan/{referral}/pesan', [ReferralController::class, 'message'])->name('admin.rujukan.pesan');
    Route::post('/rujukan/{referral}/berhasil', [ReferralController::class, 'confirm'])->name('admin.rujukan.berhasil');
    Route::post('/rujukan/{referral}/alihkan', [ReferralController::class, 'reassign'])->name('admin.rujukan.alihkan');
    Route::post('/rujukan/{referral}/tutup', [ReferralController::class, 'close'])->name('admin.rujukan.tutup');

    // Katalog Portal Kementerian (tujuan rujukan).
    Route::get('/portal', [PortalController::class, 'index'])->name('admin.portal');
    Route::post('/portal', [PortalController::class, 'store'])->name('admin.portal.store');
    Route::put('/portal/{portal}', [PortalController::class, 'update'])->name('admin.portal.update');
    Route::post('/portal/{portal}/cek', [PortalController::class, 'check'])->name('admin.portal.cek');

    // Basis Pengetahuan — sumber jawaban asisten AI.
    Route::get('/pengetahuan', [KnowledgeController::class, 'index'])->name('admin.pengetahuan');
    Route::get('/pengetahuan/dokumen', [KnowledgeDocumentController::class, 'index'])->name('admin.pengetahuan.dokumen');
    Route::post('/pengetahuan/dokumen', [KnowledgeDocumentController::class, 'store'])->name('admin.pengetahuan.dokumen.store');
    Route::post('/pengetahuan/dokumen/{document}/simpan', [KnowledgeDocumentController::class, 'saveDrafts'])->name('admin.pengetahuan.dokumen.simpan');
    Route::post('/pengetahuan/dokumen/{document}/ulang', [KnowledgeDocumentController::class, 'retry'])->name('admin.pengetahuan.dokumen.ulang');
    Route::get('/pengetahuan/dokumen/{document}/berkas', [KnowledgeDocumentController::class, 'file'])->name('admin.pengetahuan.dokumen.berkas');
    Route::delete('/pengetahuan/dokumen/{document}', [KnowledgeDocumentController::class, 'destroy'])->name('admin.pengetahuan.dokumen.destroy');
    Route::post('/pengetahuan', [KnowledgeController::class, 'store'])->name('admin.pengetahuan.store');
    Route::put('/pengetahuan/{article}', [KnowledgeController::class, 'update'])->name('admin.pengetahuan.update');
    Route::post('/pengetahuan/{article}/terbitkan', [KnowledgeController::class, 'publish'])->name('admin.pengetahuan.terbitkan');
    Route::delete('/pengetahuan/{article}', [KnowledgeController::class, 'destroy'])->name('admin.pengetahuan.destroy');

    Route::get('/kawasan', [AdminController::class, 'kawasan'])->name('admin.kawasan');
    Route::post('/kawasan', [AdminController::class, 'storeRegion'])->name('admin.kawasan.store');
    Route::put('/kawasan/{region}', [AdminController::class, 'updateRegion'])->name('admin.kawasan.update');
    Route::delete('/kawasan/{region}', [AdminController::class, 'destroyRegion'])->name('admin.kawasan.destroy');

    Route::get('/kanal', [AdminController::class, 'kanal'])->name('admin.kanal');
    Route::post('/kanal', [AdminController::class, 'storeChannel'])->name('admin.kanal.store');
    Route::post('/integrasi/{channel}', [AdminController::class, 'syncChannel'])->name('admin.integrasi.sync');

    Route::get('/pengaturan', [AdminController::class, 'pengaturan'])->name('admin.pengaturan');
    Route::put('/pengaturan', [AdminController::class, 'updatePengaturan'])->name('admin.pengaturan.update');
    Route::put('/profil', [AdminController::class, 'updateOwnProfile'])->name('admin.profil.update');
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
