<?php

namespace App\Services;

use App\Models\Setting;

/**
 * Kanal resmi lain di beranda publik (strip "N kanal pengaduan resmi
 * lainnya"), diatur Super Admin di Pengaturan.
 *
 * Disimpan sebagai satu setting `kanal_publik`. Sengaja terpisah dari tabel
 * `channels` yang dipakai sebagai asal tiket dan sinkronisasi adapter.
 * Nilai bawaan diperiksa di situs resmi transmigrasi.go.id (28 Okt 2026).
 */
class PublicChannels
{
    public const KEY = 'kanal_publik';

    public const PLATFORMS = ['instagram', 'facebook', 'x', 'tiktok', 'youtube', 'lainnya'];

    /** Tautan langsung, urut sesuai tampilan setelah Social Media dan Kantor. */
    public const LINKS = ['lapor', 'kpk', 'internal'];

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'sosmed' => [
                'aktif' => true,
                'label' => 'Social Media',
                'email' => 'ppid@transmigrasi.go.id',
                'whatsapp' => '0812-9001-9358',
                'akun' => [
                    ['platform' => 'instagram', 'nama' => '@kementrans.ri', 'url' => 'https://www.instagram.com/kementrans.ri/'],
                    ['platform' => 'facebook', 'nama' => 'kementrans.ri', 'url' => 'https://www.facebook.com/kementrans.ri'],
                    ['platform' => 'x', 'nama' => '@Kementrans_RI', 'url' => 'https://x.com/Kementrans_RI'],
                    ['platform' => 'tiktok', 'nama' => '@kementrans.ri', 'url' => 'https://www.tiktok.com/@kementrans.ri'],
                    ['platform' => 'youtube', 'nama' => '@kementrans_ri', 'url' => 'https://www.youtube.com/@kementrans_ri'],
                ],
            ],
            'kantor' => [
                'aktif' => true,
                'label' => 'Kantor',
                'nama' => 'Kantor Pusat Kementerian Transmigrasi',
                'alamat' => 'Jl. TMP Kalibata No. 17, Rawajati, Pancoran, Jakarta Selatan, DKI Jakarta 12750',
                'telepon' => '021-7994372',
                'jam' => null,
                'lat' => -6.2580742,
                'lng' => 106.8593531,
            ],
            'lapor' => ['aktif' => true, 'label' => 'SP4N-LAPOR!', 'url' => 'https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi'],
            'kpk' => ['aktif' => true, 'label' => 'Whistleblowing KPK', 'url' => 'https://kws.kpk.go.id/'],
            'internal' => ['aktif' => true, 'label' => 'Pengaduan internal pegawai', 'url' => '/pengaduan/internal'],
        ];
    }

    /** Nilai tersimpan digabung dengan bawaan, agar kunci baru selalu ada. */
    public static function get(): array
    {
        $saved = Setting::get(self::KEY, []);
        $value = [];

        foreach (self::defaults() as $key => $default) {
            $value[$key] = array_replace($default, is_array($saved[$key] ?? null) ? $saved[$key] : []);
        }

        return $value;
    }

    /**
     * Aturan validasi untuk form admin. URL boleh alamat http(s) atau path
     * internal yang diawali "/" (misalnya /pengaduan/internal).
     *
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        $url = ['nullable', 'string', 'max:500', 'regex:#^(https?://[^\s]+|/[^\s]*)$#'];

        $rules = [
            'sosmed.aktif' => ['required', 'boolean'],
            'sosmed.label' => ['required', 'string', 'max:40'],
            'sosmed.email' => ['nullable', 'email', 'max:120'],
            'sosmed.whatsapp' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+\-\s()]+$/'],
            'sosmed.akun' => ['present', 'array', 'max:10'],
            'sosmed.akun.*.platform' => ['required', 'in:'.implode(',', self::PLATFORMS)],
            'sosmed.akun.*.nama' => ['required', 'string', 'max:60'],
            'sosmed.akun.*.url' => ['required', ...array_slice($url, 1)],

            'kantor.aktif' => ['required', 'boolean'],
            'kantor.label' => ['required', 'string', 'max:40'],
            'kantor.nama' => ['required', 'string', 'max:120'],
            'kantor.alamat' => ['required', 'string', 'max:300'],
            'kantor.telepon' => ['nullable', 'string', 'max:40'],
            'kantor.jam' => ['nullable', 'string', 'max:120'],
            'kantor.lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:kantor.lng'],
            'kantor.lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:kantor.lat'],
        ];

        foreach (self::LINKS as $key) {
            $rules["{$key}.aktif"] = ['required', 'boolean'];
            $rules["{$key}.label"] = ['required', 'string', 'max:40'];
            $rules["{$key}.url"] = ["required_if:{$key}.aktif,true", ...$url];
        }

        return $rules;
    }

    /** @param array<string, mixed> $data hasil validasi {@see rules()} */
    public static function put(array $data): void
    {
        foreach (['lat', 'lng'] as $coord) {
            $data['kantor'][$coord] = isset($data['kantor'][$coord]) ? (float) $data['kantor'][$coord] : null;
        }
        $data['sosmed']['akun'] = array_values($data['sosmed']['akun']);

        Setting::put(self::KEY, $data);
    }
}
