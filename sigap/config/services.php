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
        // Batas waktu per panggilan penyedia. 2 percobaan × 25 dtk + jeda < timeout
        // job RespondToMessage (60 dtk), agar galat sampai ke failed() — PRD-AI FR-AI-04.
        'timeout' => (int) env('AI_TIMEOUT', 25),
        'max_tokens' => (int) env('AI_MAX_TOKENS', 900),
        // Model penalaran: "none" mematikan proses berpikir (jauh lebih cepat).
        // Kosongkan untuk model biasa yang tidak mengenal parameter ini.
        'reasoning_effort' => env('AI_REASONING_EFFORT'),
        // Retensi catatan panggilan AI (`ai_calls`, tanpa teks) — PRD-AI FR-AI-02.
        'log_retention_days' => (int) env('AI_LOG_RETENTION_DAYS', 90),
        // Ketahanan & kendali biaya (PRD-AI FR-AI-03).
        'daily_token_budget' => (int) env('AI_DAILY_TOKEN_BUDGET', 0),
        'breaker_threshold' => (int) env('AI_BREAKER_THRESHOLD', 5),
        'breaker_cooldown' => (int) env('AI_BREAKER_COOLDOWN', 300),
        'max_calls_per_conversation_hour' => (int) env('AI_MAX_CALLS_PER_CONVERSATION_HOUR', 20),
        // Jawaban asinkron lewat antrean (PRD-AI FR-AI-04). false = jalur sinkron lama.
        'async' => (bool) env('AI_ASYNC', true),
        'queue' => env('AI_QUEUE', 'ai'),
        // Penanda "menyiapkan jawaban" lebih lama dari ini dianggap macet → serah ke petugas.
        // Di atas timeout job (60 dtk): biasanya failed() sudah menyerahkan lebih dulu.
        // Mencakup waktu antre; jangan diturunkan hanya agar serah lebih cepat (antrean ramai).
        'pending_timeout' => (int) env('AI_PENDING_TIMEOUT', 90),
        // Model khusus per tugas (kosong = AI_MODEL) — PRD-AI FR-AI-09.
        'models' => [
            'saran_tiket' => env('AI_MODEL_SARAN_TIKET'),
            'usul_artikel' => env('AI_MODEL_USUL_ARTIKEL'),
        ],
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

    // Sumber Resmi: situs yang boleh diambil untuk kutipan asisten AI. Hanya
    // domain di daftar ini (beserta subdomainnya) yang dapat didaftarkan, dan
    // pengalihan ke domain lain ditolak.
    'knowledge' => [
        'allowed_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env(
            'KNOWLEDGE_ALLOWED_HOSTS',
            'transmigrasi.go.id,peraturan.bpk.go.id,peraturan.go.id',
        ))))),
        'max_pages' => (int) env('KNOWLEDGE_MAX_PAGES', 25),
        'max_bytes' => (int) env('KNOWLEDGE_MAX_BYTES', 20 * 1024 * 1024),
        'timeout' => (int) env('KNOWLEDGE_TIMEOUT', 30),
    ],

];
