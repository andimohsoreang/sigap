<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Server Side Rendering
    |--------------------------------------------------------------------------
    |
    | SIGAP baru akan mengaktifkan SSR pada fase optimasi. Saat ini rendering
    | dilakukan di sisi klien (Vite dev/build).
    |
    */
    'ssr' => [
        'enabled' => false,
        'url' => 'http://127.0.0.1:13714',
    ],

    /*
    |--------------------------------------------------------------------------
    | Testing
    |--------------------------------------------------------------------------
    |
    | Halaman React SIGAP berada pada resources/js/pages (huruf kecil).
    |
    */
    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => [
            resource_path('js/pages'),
        ],
        'page_extensions' => [
            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',
        ],
    ],

];
