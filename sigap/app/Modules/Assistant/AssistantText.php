<?php

namespace App\Modules\Assistant;

/**
 * Kalimat tetap TARA dari lang/id/asisten.php, selalu dengan locale `id`
 * (terlepas dari APP_LOCALE). Kunci yang tidak ada adalah kesalahan program.
 */
final class AssistantText
{
    /** @param  array<string, string>  $replace */
    public static function get(string $key, array $replace = []): string
    {
        $text = __('asisten.'.$key, $replace, 'id');
        if (! is_string($text) || $text === 'asisten.'.$key) {
            throw new \LogicException("Teks asisten tidak ditemukan: {$key}");
        }

        return $text;
    }
}
