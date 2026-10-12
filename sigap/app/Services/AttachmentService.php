<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\File\File;

/**
 * Penyimpanan lampiran pada disk lokal (PRD D4).
 *
 * File disimpan di storage/app/private dan TIDAK dapat diakses lewat URL
 * publik — penyajian dilakukan controller ter-otorisasi (SEC-09).
 */
class AttachmentService
{
    public const DISK = 'local';

    /** Simpan file dan kembalikan path relatif; null bila tidak ada. */
    public function store(?UploadedFile $file, string $folder = 'lampiran'): ?string
    {
        if (! $file) {
            return null;
        }

        $name = Str::uuid()->toString().'.'.$file->getClientOriginalExtension();

        return $file->storeAs($folder, $name, self::DISK);
    }

    /** Ambil file fisik; null bila path kosong. */
    public function file(?string $path): ?File
    {
        if (! $path) {
            return null;
        }

        $full = storage_path('app/private/'.$path);

        return is_file($full) ? new File($full) : null;
    }
}