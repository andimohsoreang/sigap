<?php

namespace App\Modules\Assistant;

/**
 * Keputusan {@see ResponsePolicy} untuk satu pesan warga; diubah menjadi pesan
 * oleh {@see ReplyComposer}. `answerFirst`: jawaban bersumber ditampilkan lebih
 * dulu sebelum langkah berikutnya (rujukan, ringkasan aduan, serah ke petugas).
 */
final readonly class Decision
{
    /** Jawab dari sumber (atau arahan tetap bila sumber tidak ada). */
    public const ANSWER = 'jawab';

    /** Serah ke petugas dengan alasan `reason`, didahului pemberitahuan `notice` bila ada. */
    public const HANDOFF = 'serah';

    /** Sumber resmi berbeda dan label dasar hukum tidak memutuskan (FR-AI-11). */
    public const CONFLICT = 'sumber_berbeda';

    /** Aduan tanpa detail: tanya masalahnya dulu. */
    public const ASK_DETAILS = 'tanya_detail';

    /** Rujuk ke portal yang menangani aduan itu. */
    public const REFER = 'rujuk';

    /** Pertanyaan informasi yang perlu ditelaah petugas. */
    public const COMPLEX = 'kompleks';

    public const COMPLAINT = 'aduan';

    public const PERSONAL = 'pribadi';

    public const UNCLEAR = 'tidak_jelas';

    /** Di luar layanan atau sapaan: jawaban model, atau kalimat tetap. */
    public const OUT_OF_SCOPE = 'lainnya';

    /** Saat menunggu petugas: tanda terima. */
    public const RECEIPT = 'tanda_terima';

    private function __construct(
        public string $type,
        public bool $answerFirst = false,
        public ?string $reason = null,
        public ?string $notice = null,
    ) {}

    public static function of(string $type, bool $answerFirst = false): self
    {
        return new self($type, $answerFirst);
    }

    /** @param  string|null  $notice  kunci lang/id/asisten.php */
    public static function handoff(string $reason, ?string $notice = null): self
    {
        return new self(self::HANDOFF, false, $reason, $notice);
    }
}
