<?php

namespace App\Services\Ai;

/**
 * Penghubung ke model bahasa. Implementasi dipilih lewat `services.ai.driver`
 * sehingga penyedia (OpenCode Zen, Ollama, vLLM, …) bisa diganti tanpa
 * mengubah kode pemanggil.
 */
interface LlmClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  bool  $json  minta keluaran berupa satu objek JSON
     *
     * @throws AiException bila model tidak dapat dihubungi atau membalas kosong
     */
    public function complete(array $messages, bool $json = false): string;
}
