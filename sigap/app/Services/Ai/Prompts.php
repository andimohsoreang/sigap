<?php

namespace App\Services\Ai;

use App\Modules\Ai\Prompts\JawabPrompt;
use App\Modules\Ai\Prompts\SaranTiketPrompt;
use App\Modules\Ai\Prompts\UsulArtikelPrompt;

/**
 * Akses lama ke prompt sistem. Isi & versi kini di `App\Modules\Ai\Prompts`
 * (PRD-AI FR-AI-06); kelas ini hanya meneruskan agar driver `fake` dan
 * pemanggil lama tetap bekerja. Baris pertama (`TUGAS: …`) dipakai
 * {@see FakeLlmClient} untuk mengenali tugas.
 */
final class Prompts
{
    public const TASK_ANSWER = JawabPrompt::TASK_LINE;

    public const TASK_PROPOSE = UsulArtikelPrompt::TASK_LINE;

    public const TASK_TICKET = SaranTiketPrompt::TASK_LINE;

    public static function answer(): string
    {
        return JawabPrompt::system();
    }

    public static function propose(): string
    {
        return UsulArtikelPrompt::system();
    }

    public static function ticket(): string
    {
        return SaranTiketPrompt::system();
    }

    public static function decodeJson(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $decoded = json_decode(substr($content, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : null;
    }
}
