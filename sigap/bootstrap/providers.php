<?php

use App\Modules\Ai\AiServiceProvider;
use App\Modules\Assistant\AssistantServiceProvider;
use App\Modules\Knowledge\KnowledgeServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\ChannelsServiceProvider;

return [
    AppServiceProvider::class,
    AiServiceProvider::class,
    KnowledgeServiceProvider::class,
    AssistantServiceProvider::class,
    ChannelsServiceProvider::class,
];
