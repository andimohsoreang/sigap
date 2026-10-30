<?php

namespace App\Support;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Models\Category;
use App\Models\Region;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Saringan daftar tiket panel admin (Matriks Rekapitulasi & Manajemen Tiket).
 *
 * Parameter query: status, region_id, provinsi (nama provinsi kawasan),
 * category_id, impact, q, periode
 * (`YYYY-MM` atau `semua`), kanal (kunci {@see TicketIntake::KANAL}),
 * petugas (id petugas atau `none`), ews (`1` = lewat tenggat SLA).
 */
final class TicketFilters
{
    public const SEMUA = 'semua';

    /**
     * Periode aktif. Nilai tidak sah diganti default: bulan berjalan bila
     * $defaultCurrentMonth, selain itu tanpa saringan periode ('').
     */
    public static function periode(Request $request, bool $defaultCurrentMonth = false): string
    {
        $value = $request->string('periode')->toString();

        if ($value === self::SEMUA || preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value)) {
            return $value;
        }

        return $defaultCurrentMonth ? now()->format('Y-m') : '';
    }

    /**
     * Rentang waktu periode (awal & akhir bulan), null = semua waktu.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public static function range(string $periode): ?array
    {
        if ($periode === '' || $periode === self::SEMUA) {
            return null;
        }

        $start = CarbonImmutable::createFromFormat('!Y-m', $periode)->startOfMonth();

        return [$start, $start->endOfMonth()];
    }

    public static function apply($query, Request $request, string $periode = ''): void
    {
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('region_id')) {
            $query->where('region_id', $request->integer('region_id'));
        }
        if ($request->filled('provinsi')) {
            self::applyProvince($query, $request->string('provinsi')->toString());
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }
        if ($request->filled('impact')) {
            $query->where('impact', $request->string('impact'));
        }
        if ($request->filled('kanal')) {
            TicketIntake::applyKanal($query, $request->string('kanal')->toString());
        }
        if ($request->filled('petugas')) {
            $request->string('petugas')->toString() === 'none'
                ? $query->whereNull('assignee_id')
                : $query->where('assignee_id', $request->integer('petugas'));
        }
        if ($request->boolean('ews')) {
            $query->whereIn('status', self::openStatuses())
                ->whereNotNull('sla_due_at')
                ->where('sla_due_at', '<', now());
        }
        if ($range = self::range($periode)) {
            $query->whereBetween('created_at', $range);
        }
        if ($request->filled('q')) {
            Search::apply($query, ['title', 'ticket_no'], $request->string('q')->toString());
        }
    }

    /** @return array<string, string> */
    public static function props(Request $request, string $periode = ''): array
    {
        return [
            'q' => $request->string('q')->toString(),
            'status' => $request->string('status')->toString(),
            'region_id' => $request->string('region_id')->toString(),
            'provinsi' => $request->string('provinsi')->toString(),
            'category_id' => $request->string('category_id')->toString(),
            'impact' => $request->string('impact')->toString(),
            'kanal' => $request->string('kanal')->toString(),
            'petugas' => $request->string('petugas')->toString(),
            'ews' => $request->boolean('ews') ? '1' : '',
            'periode' => $periode,
            'sort' => $request->string('sort')->toString(),
        ];
    }

    /**
     * Label saringan aktif yang tidak punya kontrol sendiri di halaman
     * (mis. datang dari klik sel matriks), untuk ditampilkan sebagai chip.
     *
     * @return list<array{key: string, label: string}>
     */
    public static function chips(Request $request, string $periode = ''): array
    {
        $chips = [];

        if ($range = self::range($periode)) {
            $chips[] = ['key' => 'periode', 'label' => 'Periode: '.self::monthLabel($range[0])];
        }
        if ($request->filled('region_id')) {
            $name = Region::query()->whereKey($request->integer('region_id'))->value('name');
            $chips[] = ['key' => 'region_id', 'label' => 'Kawasan: '.($name ?? '—')];
        }
        if ($request->filled('provinsi')) {
            $chips[] = ['key' => 'provinsi', 'label' => 'Provinsi: '.$request->string('provinsi')->toString()];
        }
        if ($request->filled('category_id')) {
            $name = Category::query()->whereKey($request->integer('category_id'))->value('name');
            $chips[] = ['key' => 'category_id', 'label' => 'Kategori: '.($name ?? '—')];
        }
        if ($impact = TicketImpact::tryFrom($request->string('impact')->toString())) {
            $chips[] = ['key' => 'impact', 'label' => 'Dampak: '.$impact->label()];
        }
        if ($label = TicketIntake::KANAL[$request->string('kanal')->toString()] ?? null) {
            $chips[] = ['key' => 'kanal', 'label' => 'Kanal: '.$label];
        }
        if ($request->filled('petugas')) {
            $name = $request->string('petugas')->toString() === 'none'
                ? 'Belum ditugaskan'
                : (User::query()->whereKey($request->integer('petugas'))->value('name') ?? '—');
            $chips[] = ['key' => 'petugas', 'label' => 'Petugas: '.$name];
        }
        if ($request->boolean('ews')) {
            $chips[] = ['key' => 'ews', 'label' => 'Lewat tenggat SLA'];
        }

        return $chips;
    }

    /** @return list<string> */
    /** Tiket yang kawasannya berada di provinsi ini (nama seperti di data kawasan). */
    public static function applyProvince($query, string $province): void
    {
        $query->whereHas('region', fn ($q) => $q->where('province', $province));
    }

    public static function openStatuses(): array
    {
        return [TicketStatus::Baru->value, TicketStatus::Verifikasi->value, TicketStatus::Diproses->value];
    }

    /** Nama bulan Indonesia tanpa bergantung pada locale aplikasi. */
    public static function monthLabel(CarbonImmutable $date): string
    {
        $months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        return $months[$date->month - 1].' '.$date->year;
    }
}
