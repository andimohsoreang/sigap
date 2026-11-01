<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Modules\Ai\AiHealth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman Kesehatan AI (PRD-AI FR-AI-08) — khusus Super Admin. Hanya angka
 * dari `ai_calls`, riwayat uji kualitas, dan status sirkuit/anggaran.
 */
class AiHealthController extends Controller
{
    public function __invoke(AiHealth $health): Response
    {
        return Inertia::render('admin/kesehatan-ai', $health->snapshot());
    }
}
