@php
    $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
@endphp
<x-mail::message>
# {{ $payload['heading'] ?? 'Perkembangan tiket Contact Center' }}

{{ $payload['intro'] ?? '' }}

@if (! empty($payload['quote']))
<x-mail::panel>
{{ $payload['quote'] }}
</x-mail::panel>
@endif

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
{{ $payload['cta_label'] ?? 'Lacak tiket' }}
</x-mail::button>
@endisset

Surel ini dikirim otomatis. Jangan membalas surel ini; gunakan live chat di situs Contact Center bila ada pertanyaan.

{{ config('app.name') }} · Kementerian Transmigrasi Republik Indonesia
</x-mail::message>
