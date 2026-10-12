<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\File\File;

/**
 * Penyimpanan lampiran pada disk lokal (PRD D4).
 *
 * File disimpan di storage/app/private dan TIDAK dapat diakses lewat URL
 * publik — penyajian dilakukan controller ter-otorisasi (SEC-09).
 *
 * A-16: ekstensi file ditentukan dari isi file (MIME hasil deteksi server),
 * BUKAN dari nama file kiriman klien, dan dibatasi pada whitelist.
 */
class AttachmentService
{
    public const DISK = 'local';

    /** Whitelist MIME -> ekstensi yang boleh disimpan. */
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/pjpeg' => 'jpg',
        'image/png' => 'png',
        'application/pdf' => 'pdf',
    ];

    /** Simpan file dan kembalikan path relatif; null bila tidak ada. */
    public function store(?UploadedFile $file, string $folder = 'lampiran'): ?string
    {
        if (! $file) {
            return null;
        }

        $name = Str::uuid()->toString().'.'.$this->extensionFor($file);

        $path = $file->storeAs($folder, $name, self::DISK);

        if ($path === false) {
            throw new \RuntimeException('Lampiran gagal disimpan.');
        }

        return $path;
    }

    /** Hapus file lampiran (best-effort). */
    public function delete(?string $path): void
    {
        if (! $path) {
            return;
        }

        try {
            Storage::disk(self::DISK)->delete($path);
        } catch (\Throwable $e) {
            Log::warning('Gagal menghapus lampiran: '.$e->getMessage());
        }
    }

    /** Ambil file fisik; null bila path kosong. */
    public function file(?string $path): ?File
    {
        if (! $path) {
            return null;
        }

        $full = Storage::disk(self::DISK)->path($path);

        return is_file($full) ? new File($full) : null;
    }

    /** Ekstensi dari MIME hasil deteksi isi file, dibatasi whitelist. */
    private function extensionFor(UploadedFile $file): string
    {
        $mime = (string) $file->getMimeType();

        if (isset(self::MIME_EXTENSIONS[$mime])) {
            return self::MIME_EXTENSIONS[$mime];
        }

        $guessed = strtolower((string) $file->guessExtension());

        if ($guessed === 'jpeg') {
            $guessed = 'jpg';
        }

        if (in_array($guessed, self::MIME_EXTENSIONS, true)) {
            return $guessed;
        }

        // Validasi `mimes:` seharusnya sudah menolak; ini jaring pengaman.
        return 'bin';
    }
}
