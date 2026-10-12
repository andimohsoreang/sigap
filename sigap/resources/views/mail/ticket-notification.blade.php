@php
    $meta = is_array($this->payload['meta'] ?? null) ? $this->payload['meta'] : [];
@endphp
<x-mail::message>
# {{ $this->payload['title'] ?? 'SIGAP — Notifikasi' }}

{{ $this->payload['body'] ?? '' }}

@if (count($meta))
<x-mail::table>
| Keterangan | Nilai |
|---|---|
@foreach ($meta as $label => $value)
| {{ $label }} | {{ $value }} |
@endforeach
</x-mail::table>
@endif

@isset($this->payload['cta_url'])
<x-mail::button :url="config('app.url') . $this->payload['cta_url']">
{{ $this->payload['cta_label'] ?? 'Buka di SIGAP' }}
</x-mail::button>
@endisset

{{ config('app.name') }} · Kementerian Transmigrasi Republik Indonesia
</x-mail::message>