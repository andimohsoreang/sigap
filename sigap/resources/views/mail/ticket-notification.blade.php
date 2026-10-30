@php
    $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
@endphp
<x-mail::message>
# {{ $payload['title'] ?? 'Contact Center — Notifikasi' }}

{{ $payload['body'] ?? '' }}

@if (count($meta))
<x-mail::table>
| Keterangan | Nilai |
|---|---|
@foreach ($meta as $label => $value)
| {{ $label }} | {{ $value }} |
@endforeach
</x-mail::table>
@endif

@isset($payload['cta_url'])
<x-mail::button :url="config('app.url') . $payload['cta_url']">
{{ $payload['cta_label'] ?? 'Buka di Contact Center' }}
</x-mail::button>
@endisset

{{ config('app.name') }} · Kementerian Transmigrasi Republik Indonesia
</x-mail::message>