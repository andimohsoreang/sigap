<?php

namespace App\Modules\Ai;

/** Driver yang dapat melaporkan pemakaian token dari panggilan terakhirnya. */
interface ReportsUsage
{
    /** @return array{prompt: int|null, completion: int|null}|null */
    public function lastUsage(): ?array;
}
