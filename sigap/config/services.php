<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Google reCAPTCHA v2/v3 (PRD SEC-10). Bila `secret` kosong, verifikasi
    // otomatis dilewati sehingga pengembangan lokal tidak perlu kunci.
    'recaptcha' => [
        'site_key' => env('RECAPTCHA_SITE_KEY'),
        'secret' => env('RECAPTCHA_SECRET_KEY'),
        'verify_url' => env('RECAPTCHA_VERIFY_URL', 'https://www.google.com/recaptcha/api/siteverify'),
        'min_score' => env('RECAPTCHA_MIN_SCORE', 0.5),
    ],

    // Asisten AI contact center. `enabled=false` = live chat lama (langsung ke
    // petugas). Driver `openai` memakai endpoint Chat Completions yang
    // kompatibel OpenAI (OpenCode Zen, Ollama, vLLM, dll.); `fake` menjawab
    // secara deterministik dari Basis Pengetahuan untuk lokal & pengujian.
    'ai' => [
        'enabled' => (bool) env('AI_ENABLED', false),
        'driver' => env('AI_DRIVER', 'fake'),
        'base_url' => rtrim((string) env('AI_BASE_URL', 'https://opencode.ai/inference/openai/v1'), '/'),
        'api_key' => env('AI_API_KEY'),
        'model' => env('AI_MODEL', 'deepseek-v4.1-flash'),
        'timeout' => (int) env('AI_TIMEOUT', 45),
        'max_tokens' => (int) env('AI_MAX_TOKENS', 900),
        // Jam layanan petugas (WIB). Di luar jam ini, percakapan yang
        // diteruskan diberi nomor referensi dan warga diminta kontak.
        'service_hours' => [
            'timezone' => 'Asia/Jakarta',
            'days' => array_map('intval', explode(',', (string) env('AI_SERVICE_DAYS', '1,2,3,4,5'))),
            'start' => env('AI_SERVICE_START', '08:00'),
            'end' => env('AI_SERVICE_END', '16:00'),
            'label' => env('AI_SERVICE_LABEL', 'Senin–Jumat, 08.00–16.00 WIB'),
        ],
    ],

];
