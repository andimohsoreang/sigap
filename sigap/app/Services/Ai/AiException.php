<?php

namespace App\Services\Ai;

use RuntimeException;

/** Model AI tidak dapat dipakai (jaringan, kuota, kunci salah, balasan kosong). */
class AiException extends RuntimeException {}
