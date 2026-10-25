<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Lampiran foto/dokumen di chat. Disimpan di disk privat
 * (storage/app/private/chat/{percakapan}) dan hanya disajikan lewat
 * controller yang memeriksa kepemilikan.
 *
 * Foto di-encode ulang dengan GD: metadata EXIF (termasuk lokasi GPS dan
 * merek HP) terbuang, orientasi dibetulkan, sisi terpanjang maks. 2000 px,
 * dan payload tersembunyi di dalam file gambar ikut hilang.
 */
class ChatAttachmentService
{
    public const DISK = 'local';

    public const MAX_KB = 5120;

    /** MIME hasil deteksi isi file → ekstensi. */
    public const TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];

    private const MAX_SIDE = 2000;

    /**
     * @return array{path: string, nama: string, mime: string, ukuran: int}
     */
    public function store(UploadedFile $file, int $conversationId): array
    {
        $mime = (string) $file->getMimeType();
        if (! isset(self::TYPES[$mime])) {
            throw new \InvalidArgumentException('Jenis file tidak didukung.');
        }

        $path = 'chat/'.$conversationId.'/'.Str::uuid().'.'.self::TYPES[$mime];
        $contents = str_starts_with($mime, 'image/') ? $this->sanitizeImage($file, $mime) : null;

        $ok = $contents !== null
            ? Storage::disk(self::DISK)->put($path, $contents)
            : $file->storeAs(dirname($path), basename($path), self::DISK) !== false;

        if (! $ok) {
            throw new \RuntimeException('Lampiran gagal disimpan.');
        }

        return [
            'path' => $path,
            'nama' => self::safeName($file->getClientOriginalName(), self::TYPES[$mime]),
            'mime' => $mime,
            'ukuran' => (int) Storage::disk(self::DISK)->size($path),
        ];
    }

    public function absolutePath(string $path): ?string
    {
        $full = Storage::disk(self::DISK)->path($path);

        return is_file($full) ? $full : null;
    }

    /** Hapus semua lampiran satu percakapan (dipakai saat retensi). */
    public function deleteConversation(int $conversationId): void
    {
        try {
            Storage::disk(self::DISK)->deleteDirectory('chat/'.$conversationId);
        } catch (\Throwable $e) {
            Log::warning('Gagal menghapus lampiran chat: '.$e->getMessage());
        }
    }

    /** Encode ulang gambar tanpa metadata; null bila GD tidak tersedia/gagal. */
    private function sanitizeImage(UploadedFile $file, string $mime): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            Log::warning('GD tidak tersedia: foto chat disimpan tanpa membuang EXIF.');

            return null;
        }

        $raw = (string) file_get_contents($file->getRealPath());
        $image = @imagecreatefromstring($raw);
        if ($image === false) {
            throw new \InvalidArgumentException('File gambar rusak atau tidak dapat dibaca.');
        }

        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $orientation = (int) (@exif_read_data($file->getRealPath())['Orientation'] ?? 1);
            $rotated = match ($orientation) {
                3 => imagerotate($image, 180, 0),
                6 => imagerotate($image, -90, 0),
                8 => imagerotate($image, 90, 0),
                default => null,
            };
            if ($rotated) {
                imagedestroy($image);
                $image = $rotated;
            }
        }

        $w = imagesx($image);
        $h = imagesy($image);
        $scale = min(1, self::MAX_SIDE / max($w, $h));
        if ($scale < 1) {
            $resized = imagescale($image, (int) round($w * $scale), (int) round($h * $scale));
            if ($resized) {
                imagedestroy($image);
                $image = $resized;
            }
        }

        ob_start();
        match ($mime) {
            'image/png' => (function () use ($image) {
                imagesavealpha($image, true);
                imagepng($image, null, 6);
            })(),
            'image/webp' => imagewebp($image, null, 82),
            default => imagejpeg($image, null, 85),
        };
        $out = (string) ob_get_clean();
        imagedestroy($image);

        return $out !== '' ? $out : null;
    }

    /** Nama file aman untuk ditampilkan & diunduh (tanpa path/karakter kontrol). */
    public static function safeName(string $original, string $ext): string
    {
        $base = pathinfo(basename($original), PATHINFO_FILENAME);
        $base = preg_replace('/[^\pL\pN ._()-]+/u', '_', $base) ?? '';
        $base = trim(Str::limit($base, 80, ''), ' ._');

        return ($base !== '' ? $base : 'lampiran').'.'.$ext;
    }
}
