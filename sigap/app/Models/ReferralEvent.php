<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu langkah pada jejak rujukan (dibuat, dibuka, catatan petugas, berhasil, …). */
class ReferralEvent extends Model
{
    public const UPDATED_AT = null;

    public const LABELS = [
        'dibuat' => 'Rujukan dibuat',
        'ditugaskan' => 'Penanggung jawab ditetapkan',
        'dialihkan' => 'Penanggung jawab dialihkan',
        'dibuka' => 'Warga membuka portal tujuan',
        'butuh_bantuan' => 'Warga meminta bantuan',
        'catatan' => 'Catatan tindak lanjut',
        'pesan' => 'Pesan ke warga',
        'pengingat' => 'Pengingat tindak lanjut',
        'pengingat_warga' => 'Warga diingatkan lewat chat',
        'berhasil' => 'Warga berhasil',
        'gagal' => 'Ditutup tidak berhasil',
    ];

    protected $fillable = ['referral_id', 'user_id', 'actor', 'type', 'note'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function referral(): BelongsTo
    {
        return $this->belongsTo(Referral::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
