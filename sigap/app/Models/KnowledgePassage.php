<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/** Potongan teks dari Sumber Resmi beserta alamat dan halaman asalnya. */
class KnowledgePassage extends Model
{
    protected $fillable = [
        'knowledge_source_id',
        'url',
        'title',
        'heading',
        'page',
        'body',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'page' => 'integer',
            'position' => 'integer',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(KnowledgeSource::class, 'knowledge_source_id');
    }

    /** Judul yang dibaca warga, mis. "Tata Cara Bertransmigrasi — Persyaratan". */
    public function displayTitle(): string
    {
        $title = $this->title ?: $this->source?->name ?: 'Sumber resmi';

        return $this->heading && ! Str::contains(Str::lower($title), Str::lower($this->heading))
            ? Str::limit("{$title} — {$this->heading}", 200)
            : Str::limit($title, 200);
    }

    /** Label rujukan, mis. "sibarduktrans.transmigrasi.go.id · diambil 27 Okt 2026" atau "Pedoman.pdf · Hal. 4". */
    public function label(): string
    {
        $source = $this->source;
        $origin = $source?->isSite()
            ? (parse_url((string) ($this->url ?: $source->url), PHP_URL_HOST) ?: $source->name)
            : ($source?->name ?? 'Berkas resmi');

        $parts = [$origin];
        if ($this->page) {
            $parts[] = "Hal. {$this->page}";
        }
        if ($source?->fetched_at) {
            $parts[] = 'diambil '.$source->fetched_at->locale('id')->timezone('Asia/Jakarta')->translatedFormat('j M Y');
        }

        return implode(' · ', $parts);
    }

    /** Tautan ke asal kutipan; PDF langsung ke halamannya. */
    public function link(): ?string
    {
        $base = $this->source?->isSite() ? $this->url : $this->source?->publicFileUrl();
        if ($base === null || $base === '') {
            return null;
        }

        $isPdf = $this->source?->isSite()
            ? Str::endsWith(Str::lower((string) parse_url($base, PHP_URL_PATH)), '.pdf')
            : Str::endsWith(Str::lower((string) $this->source?->document?->path), '.pdf');

        return $this->page && $isPdf ? "{$base}#page={$this->page}" : $base;
    }
}
