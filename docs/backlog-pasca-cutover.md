# Backlog Pasca-Cutover

Perbaikan yang **mengubah tampilan atau perilaku** sehingga tidak boleh dikerjakan selama rewrite (paritas 0 piksel
dan perilaku identik). Diisi oleh tim slice; dikerjakan setelah S17.

| # | Asal (slice, skill/temuan) | Usulan | Dampak bila dikerjakan | Prioritas |
|---|---|---|---|---|
| 1 | Rencana §9.9 | MFA untuk admin & petugas | alur login berubah | tinggi |
| 2 | Rencana §9.9 | Format error API RFC 9457 di `/api/v2` | bentuk respons API | sedang |
| 3 | Rencana §9.9 | Libur nasional di perhitungan SLA | tenggat tiket berubah | sedang |
| 4 | Rencana §9.9 | `json` → `jsonb`, waktu → `timestamptz` | skema DB | rendah |
| 5 | Rencana §9.9 | Format enkripsi baru + rotasi kunci | data terenkripsi | sedang |
