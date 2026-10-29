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

    /**
     * Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi (UPT Kementerian
     * Transmigrasi). Kontak dari situs resmi tiap balai di transmigrasi.go.id
     * (diperiksa 29 Okt 2026). Koordinat dari OpenStreetMap; untuk Yogyakarta,
     * Denpasar, dan Banjarmasin berupa titik jalan/desa, jadi tautan Google Maps
     * mencari dengan nama + alamat agar tetap tepat.
     *
     * @var list<array<string, mixed>>
     */
    public const BALAI = [
        [
            'kode' => 'yogyakarta',
            'jenis' => 'Balai Besar',
            'provinsi' => 'DI Yogyakarta',
            'nama' => 'Balai Besar Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Yogyakarta',
            'singkat' => 'BBPPMT Yogyakarta',
            'lokasi' => 'Sleman, DI Yogyakarta',
            'alamat' => 'Jl. Parasamya Beran No. 16, Beran Kidul, Tridadi, Kec. Sleman, Kab. Sleman, DI Yogyakarta 55511',
            'telepon' => '(0274) 868315',
            'whatsapp' => '+62 823-2803-7070',
            'email' => 'bbppmtyogyakarta@www.transmigrasi.go.id',
            'website' => 'https://www.transmigrasi.go.id/bbppmtyogyakarta/',
            'sosmed' => [
                ['platform' => 'instagram', 'nama' => '@bbppmtyogyakarta', 'url' => 'https://www.instagram.com/bbppmtyogyakarta/'],
                ['platform' => 'facebook', 'nama' => '@bbppmtyogyakarta', 'url' => 'https://www.facebook.com/bbppmtyogyakarta'],
                ['platform' => 'youtube', 'nama' => '@BBPPMTYogyakarta', 'url' => 'https://www.youtube.com/@BBPPMTYogyakarta'],
            ],
            'lat' => -7.7152741,
            'lng' => 110.3557244,
        ],
        [
            'kode' => 'denpasar',
            'jenis' => 'Balai',
            'provinsi' => 'Bali',
            'nama' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Denpasar',
            'singkat' => 'BPPMT Denpasar',
            'lokasi' => 'Badung, Bali',
            'alamat' => 'Jl. Kayu Aya No. 101, Seminyak, Kuta, Kab. Badung, Bali',
            'telepon' => '(0361) 730428',
            'whatsapp' => '0812-3900-0080',
            'email' => 'bppmt.denpasar@transmigrasi.go.id',
            'website' => 'https://www.transmigrasi.go.id/bppmtdenpasar/',
            'sosmed' => [],
            'lat' => -8.6858872,
            'lng' => 115.1559081,
        ],
        [
            'kode' => 'pekanbaru',
            'jenis' => 'Balai',
            'provinsi' => 'Riau',
            'nama' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Pekanbaru',
            'singkat' => 'BPPMT Pekanbaru',
            'lokasi' => 'Kampar, Riau',
            'alamat' => 'Jl. Raya Pekanbaru–Bangkinang Km 22, Rimba Panjang, Kec. Tambang, Kab. Kampar, Riau 28462',
            'telepon' => '+62 813-7166-6641',
            'whatsapp' => '+62 813-7166-6641',
            'email' => 'bppmt.pekanbaru@transmigrasi.go.id',
            'website' => 'https://www.transmigrasi.go.id/bppmtpekanbaru/',
            'sosmed' => [
                ['platform' => 'instagram', 'nama' => '@bppmtpekanbaru', 'url' => 'https://www.instagram.com/bppmtpekanbaru/'],
                ['platform' => 'facebook', 'nama' => '@bppmtpekanbaru', 'url' => 'https://facebook.com/bppmtpekanbaru'],
                ['platform' => 'youtube', 'nama' => '@bppmtpekanbaru', 'url' => 'https://www.youtube.com/@bppmtpekanbaru'],
            ],
            'lat' => 0.4330108,
            'lng' => 101.3074768,
        ],
        [
            'kode' => 'banjarmasin',
            'jenis' => 'Balai',
            'provinsi' => 'Kalimantan Selatan',
            'nama' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Banjarmasin',
            'singkat' => 'BPPMT Banjarmasin',
            'lokasi' => 'Barito Kuala, Kalimantan Selatan',
            'alamat' => 'Jl. Handil Bhakti Km 9,5 No. 95, Kab. Barito Kuala, Kalimantan Selatan',
            'telepon' => '0811-5000-344',
            'whatsapp' => null,
            'email' => 'bppmt.banjarmasin@transmigrasi.go.id',
            'website' => 'https://www.transmigrasi.go.id/bppmtbanjarmasin/',
            'sosmed' => [
                ['platform' => 'instagram', 'nama' => '@bppmt.banjarmasin', 'url' => 'https://www.instagram.com/bppmt.banjarmasin/'],
                ['platform' => 'facebook', 'nama' => 'blm.banjarmasin', 'url' => 'https://www.facebook.com/blm.banjarmasin'],
                ['platform' => 'youtube', 'nama' => '@bppmtbanjarmasin', 'url' => 'https://www.youtube.com/@bppmtbanjarmasin'],
            ],
            'lat' => -3.2757297,
            'lng' => 114.6030097,
        ],
    ];

    /**
     * Direktori kantor: Kantor Pusat (dari setting Kantor + kontak Social
     * Media yang diatur admin) disusul balai daerah.
     *
     * @return list<array<string, mixed>>
     */
    public static function offices(): array
    {
        $kanal = self::get();
        $pusat = [
            'kode' => 'pusat',
            'jenis' => 'Kantor Pusat',
            'provinsi' => 'DKI Jakarta',
            'nama' => $kanal['kantor']['nama'],
            'singkat' => 'Kantor Pusat',
            'lokasi' => 'Jakarta Selatan, DKI Jakarta',
            'alamat' => $kanal['kantor']['alamat'],
            'telepon' => $kanal['kantor']['telepon'],
            'whatsapp' => $kanal['sosmed']['whatsapp'],
            'email' => $kanal['sosmed']['email'],
            'website' => 'https://www.transmigrasi.go.id/',
            'sosmed' => $kanal['sosmed']['akun'],
            'jam' => $kanal['kantor']['jam'],
            'lat' => $kanal['kantor']['lat'],
            'lng' => $kanal['kantor']['lng'],
        ];

        return array_map(fn (array $o) => $o + [
            'jam' => null,
            'maps' => 'https://www.google.com/maps/search/?api=1&query='.rawurlencode($o['nama'].', '.$o['alamat']),
        ], [$pusat, ...self::BALAI]);
    }

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
            'lapor' => [
                'aktif' => true,
                'label' => 'SP4N-LAPOR!',
                'url' => 'https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi',
                'deskripsi' => 'Pengaduan pelayanan publik nasional. Cocok bila masalah juga menyangkut instansi lain; identitas dapat dirahasiakan.',
            ],
            'kpk' => [
                'aktif' => true,
                'label' => 'Whistleblowing KPK',
                'url' => 'https://kws.kpk.go.id/',
                'deskripsi' => 'Laporkan dugaan tindak pidana korupsi langsung ke KPK. Identitas pelapor dijaga kerahasiaannya.',
            ],
            'internal' => [
                'aktif' => true,
                'label' => 'Pengaduan internal pegawai',
                'url' => '/pengaduan/internal',
                'deskripsi' => 'Laporkan gangguan sarana dan TIK kantor. Khusus pegawai Kementerian Transmigrasi.',
            ],
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
            $rules["{$key}.deskripsi"] = ['nullable', 'string', 'max:200'];
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
