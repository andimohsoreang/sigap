<?php

use App\Http\Controllers\Api\V1\Admin\DashboardController;
use App\Http\Controllers\Api\V1\Admin\IntegrasiController;
use App\Http\Controllers\Api\V1\Admin\MasterController;
use App\Http\Controllers\Api\V1\Admin\TicketsController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\KatalogController;
use App\Http\Controllers\Api\V1\PengaduanController;
use App\Http\Controllers\Api\V1\SurveiController;
use App\Http\Controllers\Api\V1\TiketController;
use App\Http\Controllers\Api\V1\WargaController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SIGAP API v1 (PRD D1)
|--------------------------------------------------------------------------
| Lapisan ini memakai Service/Request/Resource yang SAMA dengan jalur Inertia
| sehingga data dapat dikeluarkan sebagai REST API kapan pun diminta.
*/

Route::prefix('v1')->group(function () {

    // Health check (L-02): hanya status & ping DB — tanpa statistik data.
    Route::get('/health', function () {
        try {
            DB::connection()->select('select 1');
            $database = true;
        } catch (Throwable) {
            $database = false;
        }

        return response()->json([
            'ok' => $database,
            'service' => 'sigap-api',
            'database' => $database ? 'ok' : 'down',
            'time' => now()->toIso8601String(),
        ], $database ? 200 : 503);
    })->middleware('throttle:health');

    // ---- Auth (publik) ----
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/auth/session', [AuthController::class, 'session']);

    // ---- Publik ----
    Route::post('/pengaduan', [PengaduanController::class, 'store'])->middleware('throttle:pengaduan');
    Route::post('/pengaduan/internal', [PengaduanController::class, 'storeInternal'])->middleware('throttle:pengaduan');
    // Pencarian tiket & survei publik dibatasi limiter 'lookup' (anti-enumerasi).
    Route::get('/tiket/{ticket_no}', [TiketController::class, 'show'])->middleware('throttle:lookup');
    Route::post('/survei/{ticket_no}', [SurveiController::class, 'store'])->middleware(['throttle:lookup', 'throttle:pengaduan']);
    Route::get('/katalog/kanal', [KatalogController::class, 'kanal']);
    Route::get('/regions', [KatalogController::class, 'regions']);

    // ---- Warga ----
    Route::middleware(['auth:sanctum', 'role:warga'])->prefix('warga')->group(function () {
        Route::get('/session', [WargaController::class, 'session']);
        Route::get('/profile', [WargaController::class, 'profile']);
        Route::patch('/profile', [WargaController::class, 'updateProfile']);
        Route::get('/tickets', [WargaController::class, 'tickets']);
    });

    // ---- Admin ----
    Route::middleware(['auth:sanctum', 'role:admin_kawasan,super_admin'])->prefix('admin')->group(function () {
        Route::get('/tickets', [TicketsController::class, 'index']);
        Route::post('/input-manual', [PengaduanController::class, 'storeManual']);
        Route::get('/tiket-internal', [TicketsController::class, 'internal']);
        Route::get('/rekap', [DashboardController::class, 'rekap']);
        Route::get('/tickets/{ticket_no}', [TicketsController::class, 'show']);
        Route::post('/tickets/{ticket_no}/status', [TicketsController::class, 'updateStatus']);
        Route::post('/tickets/{ticket_no}/tanggapan', [TicketsController::class, 'reply']);

        // Master data
        Route::get('/kawasan', [MasterController::class, 'regions']);
        Route::post('/kawasan', [MasterController::class, 'storeRegion']);
        Route::put('/kawasan/{region}', [MasterController::class, 'updateRegion']);
        Route::delete('/kawasan/{region}', [MasterController::class, 'destroyRegion']);

        Route::get('/kanal', [MasterController::class, 'channels']);
        Route::post('/kanal', [MasterController::class, 'storeChannel']);

        Route::get('/pengaturan', [MasterController::class, 'settings']);
        Route::put('/pengaturan', [MasterController::class, 'updateSettings']);

        // Super admin only
        Route::middleware('role:super_admin')->group(function () {
            Route::get('/admins', [MasterController::class, 'admins']);
            Route::post('/admins', [MasterController::class, 'storeAdmin']);
        });
        // Log sinkronisasi (semua admin) dan pemicu sinkronisasi (super admin).
        Route::get('/integrasi/log', [IntegrasiController::class, 'logs']);
        Route::post('/integrasi/{channel}', [IntegrasiController::class, 'sync']);
    });
});
