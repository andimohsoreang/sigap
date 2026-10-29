<?php

namespace App\Services\Ai;

use RuntimeException;

/** Model AI tidak dapat dipakai (jaringan, kuota, kunci salah, balasan kosong). */
class AiException extends RuntimeException
{
    /**
     * @param  string|null  $reason  kode singkat untuk catatan `ai_calls`
     *                               (mis. `timeout`, `koneksi`, `http_503`, `kosong`); bukan isi teks
     */
    public function __construct(string $message = '', public readonly ?string $reason = null)
    {
        parent::__construct($message);
    }
}
