<?php

use App\Modules\Ai\AiServiceProvider;
use App\Modules\Knowledge\KnowledgeServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\ChannelsServiceProvider;

return [
    AppServiceProvider::class,
    AiServiceProvider::class,
    KnowledgeServiceProvider::class,
    ChannelsServiceProvider::class,
];
