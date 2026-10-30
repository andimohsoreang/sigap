# PRD — Lapisan AI SIGAP sebagai Monolith Modular

> **Untuk siapa dokumen ini:** pengembang dan **AI coding agent** yang merapikan lapisan AI SIGAP
> (TARA, Basis Pengetahuan, rujukan portal, saran tiket). Dokumen ini menetapkan **apa** yang dicapai,
> **batas modul**, **urutan tahap**, dan **kriteria selesai**. Rincian deploy tetap di
> [`DEPLOY.md`](DEPLOY.md) §13; PRD produk utama di [`PRD.md`](PRD.md).
>
> Versi 1.2 · 30 Oktober 2026 (1.1: FR-AI-10 — Sumber Resmi tidak disamarkan; 1.2: FR-AI-11 — Sumber berbeda & aturan lama) · Pemilik: Andi · Basis kode: branch `feat/contact-center-ai` (`b7f9525`)
>
> **Keputusan: SIGAP tetap satu aplikasi Laravel (monolith modular).** Yang dipisah hanya **mesin model
> AI** (penyedia API atau server GPU) di balik satu pintu, yaitu API kompatibel OpenAI. Tidak ada
> microservice baru.

---

## 0. Aturan wajib untuk AI agent (baca dulu)

1. **Jangan memecah aplikasi.** Tidak ada repo, image, atau database baru. Modul adalah folder dan
   namespace di dalam `sigap/`. Satu-satunya proses tambahan yang diizinkan adalah *worker antrean*
   dari image yang sama (§9).
2. **AI mati ≠ chat mati.** Dengan `AI_ENABLED=false`, atau saat penyedia AI gagal, chat harus tetap
   berjalan sebagai live chat ke petugas. Setiap tugas AI wajib punya jalur cadangan tanpa model.
3. **Tidak ada data pribadi ke model.** Semua teks ke model lewat penyamaran di AI Gateway (§5 FR-AI-01).
   Pemanggil tidak boleh memanggil `LlmClient` langsung.
4. **Migrasi hanya menambah** (tabel/kolom baru, nullable). Versi lama harus tetap bisa berjalan di atas
   skema baru agar `scripts/deploy.sh --rollback` aman.
5. **Perilaku yang terlihat warga tidak berubah** pada tahap refaktor (Tahap 0, 1, 3, 4). Teks jawaban,
   urutan pesan, dan aturan rujukan sama persis; dibuktikan oleh tes yang sudah ada.
6. **Jangan menulis kunci API** ke repo, log, atau chat. Repo ini publik.
7. Kerjakan **per tahap** (§11). Setiap tahap: tes lengkap hijau (`php artisan test`, Vitest, tsc,
   eslint, pint) → laporkan ke pemilik → baru lanjut.

---

## 1. Latar belakang

TARA, asisten contact center SIGAP, sudah berjalan di branch `feat/contact-center-ai`:

- menjawab dari **Basis Pengetahuan** (artikel terbit) dan **Sumber Resmi** (kutipan situs/berkas
  resmi) dengan sumber yang dapat diklik; tanpa sumber, tidak menebak;
- mengenali aduan/urusan pribadi lalu meneruskan ke petugas, atau **merujuk ke portal** (mis. Trans
  Tuntas) dengan petugas pendamping;
- menyarankan isian tiket (kawasan, kategori, dampak) dan mengusulkan artikel dari dokumen resmi.

Fitur sudah lengkap, tetapi **susunan kodenya belum siap dipakai model AI sungguhan dalam jumlah besar**.
Temuan pada kode saat ini:

| # | Temuan | Bukti di kode | Dampak |
|---|---|---|---|
| T1 | Model dipanggil **di dalam request chat** | `ChatController::store` → `AssistantService::respond()` → `LlmClient::complete()` | Warga menunggu sampai `AI_TIMEOUT` (45 dtk); satu proses PHP-FPM tertahan per pesan; saat ramai, halaman lain ikut lambat |
| T2 | Kelas asisten terlalu besar | `AssistantService.php` 600 baris: klasifikasi, kebijakan rujukan, status tiket, serah ke petugas, teks balasan, nomor referensi | Sulit diuji per aturan; perubahan kecil berisiko |
| T3 | Tiga tempat memanggil model dengan caranya sendiri | `AssistantService`, `TicketSuggester`, `KnowledgeDocumentService` | Penyamaran, parsing JSON, dan cadangan diulang; mudah terlewat |
| T4 | **Tidak ada catatan pemakaian AI** | tidak ada tabel/log token, waktu respons, galat | Biaya, kecepatan, dan kegagalan penyedia tidak terlihat |
| T5 | Tidak ada pelindung beban | tidak ada batas harian, pemutus sirkuit, batas per percakapan | Penyedia mati → setiap pesan menunggu batas waktu; biaya bisa melonjak |
| T6 | Prompt tanpa versi | `Prompts.php` (3 tugas) | Penurunan kualitas tidak dapat dikaitkan dengan perubahan prompt |
| T7 | Uji kualitas belum jadi gerbang | `sigap:uji-asisten` selalu keluar sukses | Prompt/model buruk bisa terbit tanpa ketahuan |

## 2. Tujuan & di luar cakupan

**Tujuan**

- G1. **Batas modul jelas**: setiap modul punya tabel, kelas publik, dan tes sendiri; aturan
  ketergantungan dijaga oleh *uji arsitektur*.
- G2. **Satu pintu AI (AI Gateway)** untuk semua tugas: penyamaran, prompt berversi, pemanggilan,
  validasi JSON, cadangan, pencatatan.
- G3. **Jawaban asinkron**: pesan warga langsung diterima; jawaban TARA dikirim oleh worker lewat Reverb
  (cadangan: polling yang sudah ada).
- G4. **Tahan gangguan & terkendali biaya**: coba ulang terbatas, pemutus sirkuit, anggaran token harian,
  batas per percakapan.
- G5. **Terukur**: setiap panggilan AI tercatat (tanpa isi teks); Super Admin melihat kesehatan AI.
- G6. **Gerbang kualitas**: uji 45+ pertanyaan dengan ambang minimum sebelum ganti model/prompt.
- G7. **Ganti penyedia tanpa ubah kode**: OpenCode Zen, Sumopod, vLLM/Ollama di server GPU kementerian,
  cukup lewat `.env`.

**Di luar cakupan**

- Memecah SIGAP menjadi microservices, Kubernetes, *message broker* (Kafka/RabbitMQ), atau Redis.
- Basis data vektor / *embedding* (pencarian BM25 tepat 43/43 pada uji terakhir; ditinjau ulang bila artikel
  dan kutipan > ±5.000).
- *Fine-tuning* model, kanal WhatsApp, perubahan alur tampilan warga/petugas.
- Membuka AI SIGAP sebagai API untuk aplikasi lain (dicatat di §14 sebagai keputusan lanjutan).

## 3. Prinsip arsitektur

1. **Satu aplikasi, banyak modul.** Modul = folder `app/Modules/<Nama>` + namespace + tes. Deploy
   tetap satu image.
2. **Modul memiliki tabelnya.** Modul lain membaca/menulis lewat kelas publik modul pemilik, bukan
   lewat model Eloquent milik modul lain.
3. **Ketergantungan satu arah** (§4.2). Komunikasi balik memakai *event* Laravel.
4. **AI hanya lewat Gateway.** Tidak ada kode di luar modul AI yang menyentuh `LlmClient`.
5. **Keputusan terpisah dari bahasa.** Aturan "jawab / rujuk / teruskan" adalah fungsi murni yang bisa
   diuji tanpa basis data dan tanpa model; teks balasan dikelola terpisah.
6. **Selalu ada cadangan deterministik** untuk setiap tugas AI.

## 4. Peta modul

### 4.1 Daftar modul

| Modul | Tanggung jawab | Tabel milik | Kelas publik (kontrak) | Asal kode sekarang |
|---|---|---|---|---|
| **Ai** (Gateway) | Penyedia model, penyamaran, prompt berversi, panggilan, validasi, cadangan, log, pemutus sirkuit, anggaran | `ai_calls` *(baru)* | `AiGateway::run(AiTask, array): AiResult` | `Services/Ai/LlmClient`, `OpenAiCompatibleClient`, `FakeLlmClient`, `PiiMasker`, `Prompts` |
| **Knowledge** | Artikel, dokumen, Sumber Resmi, kutipan, pencarian (BM25 + `IndonesianText`), pengambilan berkala | `knowledge_articles`, `knowledge_documents`, `knowledge_sources`, `knowledge_passages` | `KnowledgeSearch::sources()`, `KnowledgeSearch::terms()`; event `ArticlePublished` | `Services/Knowledge/*`, `Jobs/ProcessKnowledgeDocument`, `Jobs/SyncKnowledgeSource` |
| **Assistant** | Orkestrasi balasan TARA: konsultasi model, kebijakan respons, penyusun balasan, saran tiket | — (menulis pesan lewat ContactCenter) | `Assistant::reply(ConversationRef, MessageRef)`, `TicketSuggestions::for()` | `Services/Ai/AssistantService`, `TicketSuggester` |
| **ContactCenter** | Percakapan & pesan chat, serah ke petugas, jam layanan, Kotak Masuk, statistik | `chat_conversations`, `chat_messages` | `Conversations`, `ChatService::send()`; event `CitizenMessageReceived`, `ConversationTakenOver` | `Services/ChatService`, `ServiceHours`, `ContactCenterStats` |
| **Referral** | Katalog portal, rujukan, penanggung jawab, pengingat, tangkap kode bukti, cek tautan | `portals`, `referrals`, `referral_events` | `Referrals::create/openFor/captureFromChat/requestHelp`, `PortalDirectory` | `Services/ReferralService`, `PortalDirectory`, `PortalHealthCheck` |
| **Inti (tetap)** | Tiket & SLA, akun, notifikasi, audit, master data | tabel lama | `TicketService`, `TicketIntake`, `NotificationService`, `AuditService` | tidak dipindah |

### 4.2 Arah ketergantungan

```
ContactCenter ──event CitizenMessageReceived──▶ (job) Assistant
Assistant ──▶ Knowledge      (cari sumber)
Assistant ──▶ Referral       (rujuk / kendala / kode bukti)
Assistant ──▶ ContactCenter  (kirim balasan, serah ke petugas)
Assistant ──▶ Ai             (konsultasi, saran tiket)
Knowledge ──▶ Ai             (usul artikel dari dokumen)
Referral  ──▶ ContactCenter  (pesan ke chat warga)
Semua     ──▶ Inti           (notifikasi, audit, master data)

Dilarang: Ai ──▶ modul mana pun · Knowledge ──▶ Assistant/Referral · ContactCenter ──▶ Assistant (langsung)
```

### 4.3 Susunan folder target

```
app/Modules/
  Ai/            AiGateway, AiTask, AiResult, Drivers/{OpenAiCompatible,Fake}, PiiMasker,
                 Prompts/{Jawab,UsulArtikel,SaranTiket}, CircuitBreaker, TokenBudget, Models/AiCall
  Knowledge/     KnowledgeSearch, Retrieval/{KnowledgeRetriever,IndonesianText}, Ingestion/*, Models/*
  Assistant/     Assistant, Consultation, ResponsePolicy, Decision, ReplyComposer, TicketSuggestions,
                 Jobs/RespondToMessage
  ContactCenter/ ChatService, Conversations, ServiceHours, Stats, Events/*
  Referral/      Referrals, PortalDirectory, PortalHealthCheck, Models/*
lang/id/asisten.php   ← semua teks balasan TARA
```

## 5. Functional Requirements

### FR-AI-01 AI Gateway

- Satu titik masuk: `AiGateway::run(AiTask $task, array $input, ?Context $ctx = null): AiResult`.
- `AiTask` (enum) untuk tugas yang ada: `Jawab`, `UsulArtikel`, `SaranTiket`. Setiap tugas menetapkan:
  prompt + **versi**, model (bawaan `AI_MODEL`, boleh ditimpa per tugas), `max_tokens`, batas waktu,
  validator keluaran (skema JSON), dan **cadangan** bila gagal.
- Urutan kerja: periksa pemutus sirkuit & anggaran → **samarkan** teks masukan (kecuali konten resmi, FR-AI-10) → susun prompt →
  panggil penyedia → urai & validasi JSON → catat (`ai_calls`) → kembalikan `AiResult`
  (`ok|fallback|skipped|error`, data tervalidasi, alasan).
- Coba ulang **1 kali** untuk galat jaringan/5xx/batas waktu (jeda acak 300–800 ms). Galat 4xx tidak
  diulang, kecuali penolakan `response_format` (perilaku `OpenAiCompatibleClient` saat ini dipertahankan).
- `AssistantService`, `TicketSuggester`, `KnowledgeDocumentService` berpindah ke Gateway; tidak ada lagi
  pemanggilan `LlmClient` di luar modul Ai (dijaga uji arsitektur).

### FR-AI-02 Catatan panggilan AI

- Tabel `ai_calls`: `task`, `prompt_version`, `provider` (host `AI_BASE_URL`), `model`, `status`
  (`ok|error|timeout|fallback|skipped`), `latency_ms`, `prompt_tokens`, `completion_tokens`,
  `conversation_id` (nullable), `error_code`, `created_at`.
- **Tidak menyimpan isi pertanyaan maupun jawaban.** Isi percakapan sudah ada di `chat_messages`.
- Retensi `AI_LOG_RETENTION_DAYS` (bawaan 90 hari) lewat `model:prune`.

### FR-AI-03 Ketahanan & kendali biaya

- **Pemutus sirkuit**: ≥ `AI_BREAKER_THRESHOLD` (bawaan 5) kegagalan dalam 2 menit → terbuka selama
  `AI_BREAKER_COOLDOWN` (bawaan 300 dtk). Selama terbuka, Gateway langsung mengembalikan `fallback`
  tanpa memanggil penyedia; chat langsung diteruskan ke petugas dengan pesan yang sama seperti
  sekarang (`ai_gagal`).
- **Anggaran harian** `AI_DAILY_TOKEN_BUDGET` (0 = tanpa batas). Lewat 80% → notifikasi Super Admin;
  lewat 100% → semua tugas memakai cadangan sampai tengah malam WIB.
- **Batas per percakapan**: paling banyak `AI_MAX_CALLS_PER_CONVERSATION_HOUR` (bawaan 20) panggilan
  `Jawab` per jam; lewat batas → serah ke petugas (melindungi dari spam).
- Status sirkuit & pemakaian anggaran disimpan di *cache* aplikasi (driver `database` yang sudah ada).

### FR-AI-04 Jawaban asinkron

- `POST /chat/pesan` menyimpan pesan warga dan **langsung** membalas 201 dengan `asisten.mengetik = true`.
  Respons tidak lagi menunggu model.
- Jalur cepat tetap sinkron (tanpa model): nomor tiket `TKT-…`, kode bukti rujukan, percakapan yang
  sudah dipegang petugas.
- Selain itu, `ContactCenter` memancarkan `CitizenMessageReceived`; listener mengantrekan
  `RespondToMessage` di antrean **`ai`**.
- Job:
  - **idempoten** per `message_id`;
  - **berurutan per percakapan** (`WithoutOverlapping` dengan kunci percakapan);
  - **dilewati** bila percakapan sudah diambil petugas atau ada pesan warga yang lebih baru (jawab yang
    terbaru dengan riwayat lengkap).
- Balasan dikirim lewat `ChatService::send()` sehingga **Reverb** menyiarkannya seperti pesan petugas;
  bila Reverb mati, widget tetap mendapatkannya lewat polling `GET /chat/pesan` yang sudah ada.
- Indikator "TARA sedang mengetik…" di widget; setelah 15 dtk tanpa balasan tampil "masih menyiapkan
  jawaban"; job gagal → pesan serah ke petugas (perilaku `ai_gagal`).
- Saklar `AI_ASYNC` (bawaan `true` setelah Tahap 2; `false` = jalur sinkron lama, untuk rollback cepat).

### FR-AI-05 Asisten dipecah

- `Consultation`: menyiapkan masukan (pertanyaan, riwayat 6 pesan, sumber, portal) dan memanggil
  Gateway tugas `Jawab`.
- `ResponsePolicy::decide(AiResult, Context): Decision` (**fungsi murni**). `Decision` mencakup:
  `Answer`, `AskDetails`, `ReferToPortal(portal)`, `Handoff(reason)`, `ComplexHandoff`, `Unclear`,
  `OutOfScope`, `TicketStatus`. Semua aturan yang sekarang ada di `respond()` pindah ke sini
  apa adanya (aduan tanpa detail, portal dilacak, pertanyaan kompleks, dst.).
- `ReplyComposer`: mengubah `Decision` menjadi pesan (teks dari `lang/id/asisten.php`, meta kartu
  portal/sumber/rujukan).
- Target ukuran: tidak ada kelas di modul Assistant > 250 baris.

### FR-AI-06 Prompt berversi

- Setiap prompt adalah kelas di `Modules/Ai/Prompts` dengan konstanta `VERSION` (mis. `jawab@2026-10-30`).
- `ai_calls.prompt_version` terisi; mengubah isi prompt **wajib** menaikkan versi dan menjalankan
  FR-AI-07.

### FR-AI-07 Gerbang kualitas

- `php artisan sigap:uji-asisten` menerima ambang dan keluar dengan kode gagal bila tidak terpenuhi:
  `--min-pencarian=95 --min-klasifikasi=85 --maks-tanpa-sumber=0 --maks-p95=12`.
- CI (tanpa model) selalu menjalankan bagian pencarian (`--hanya-pencarian`).
- Pencarian dinilai berbasis isi: tiap kasus punya `harus_memuat`, frasa fakta dari teks resmi yang wajib
  ada di salah satu dari 3 sumber teratas `sources()` (artikel ATAU kutipan Sumber Resmi). Judul artikel
  (`artikel`) tetap dipakai untuk metrik terpisah "artikel saja".
- Dengan model sungguhan: wajib sebelum mengganti `AI_MODEL`, penyedia, atau versi prompt; serta
  terjadwal mingguan dengan ringkasan dikirim ke Super Admin.
- Paket uji `database/data/uji-asisten.php` bertambah dari pertanyaan nyata yang dinilai 👎 atau
  masuk "Belum bisa dijawab AI" (setelah disamarkan).

### FR-AI-08 Halaman Kesehatan AI (Super Admin)

- Lokasi: panel admin → Kelola → **Kesehatan AI**.
- Isi: status penyedia (normal / sirkuit terbuka / anggaran habis), panggilan hari ini per tugas,
  tingkat galat, waktu respons P50/P95, token terpakai vs anggaran, jumlah cadangan, hasil uji
  kualitas terakhir.
- Tanpa isi percakapan; hanya angka dari `ai_calls`.

### FR-AI-09 Penyedia & model

- Driver: `fake` (lokal & tes) dan `openai` (semua penyedia kompatibel OpenAI: OpenCode Zen, Sumopod,
  vLLM, Ollama). Pindah penyedia = ubah `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
- Model per tugas opsional: `AI_MODEL_SARAN_TIKET`, `AI_MODEL_USUL_ARTIKEL` (mis. model lebih murah
  untuk tugas klasifikasi). `AI_REASONING_EFFORT` tetap didukung.

### FR-AI-10 Privasi

- Penyamaran dipindahkan ke Gateway, sehingga semua tugas terlindungi tanpa bergantung pada pemanggil.
  Pola saat ini (NIK, nomor HP, surel, deret angka panjang) dipertahankan.
- **Yang disamarkan: teks dari warga dan teks dokumen** — pertanyaan & riwayat percakapan (`Jawab`),
  isi aduan (`SaranTiket`), dan teks halaman dokumen yang diunggah (`UsulArtikel`).
- **Yang tidak disamarkan: konten resmi/terkurasi** — kutipan **Sumber Resmi** dan artikel terbit
  (`sumber`), daftar portal (`portal`), serta data master kawasan/kategori (`kawasan`, `kategori`).
  Alasannya: kutipan resmi memuat nomor hotline/kontak resmi yang harus tetap utuh di jawaban TARA.
  Daftar kunci yang dikecualikan ditetapkan per tugas di `AiTask::trustedInput()`.
- Akibat pada `UsulArtikel`: nomor kontak di dokumen ikut tersamar (mis. `[NOMOR HP]`) pada usulan
  artikel; petugas melengkapinya saat meninjau sebelum terbit.
- Tes wajib: untuk setiap `AiTask`, teks warga/dokumen berisi NIK/HP/surel tidak pernah sampai ke driver;
  kutipan Sumber Resmi pada `Jawab` sampai ke driver tanpa diubah.
- `ai_calls` tidak menyimpan teks; log aplikasi tidak mencetak isi prompt/jawaban.

### FR-AI-11 Sumber berbeda & aturan lama

Sumber Resmi lama tidak dinonaktifkan (mis. halaman yang masih menulis batas usia 19–49 tahun di samping
SIBARDUKTRANS 19–53 tahun). TARA harus membedakan aturan yang berlaku dari aturan lama **berdasarkan data
yang diisi petugas**, bukan tebakan model.

- **Data** (migrasi hanya menambah kolom): `knowledge_sources` dan `knowledge_articles` mendapat
  `dasar_hukum` (teks), `tanggal_dasar` (tanggal penetapan), `status_dasar`
  (`berlaku` | `diganti` | `belum_diketahui`, bawaan `belum_diketahui`), dan `diganti_oleh` (teks; wajib bila
  `diganti`). Formulir Sumber Resmi dan artikel dapat mengisinya; perubahan dasar hukum Sumber Resmi
  tercatat di audit log (`knowledge.source_basis`).
- **Konteks**: setiap sumber yang dikirim ke model membawa label
  `Dasar: <peraturan> (<tahun>) — BERLAKU | DIGANTI oleh <peraturan> | BELUM DIKETAHUI`. Kutipan memakai
  label Sumber Resminya. Urutan sumber tidak diubah.
- **Prompt Jawab** (versi `jawab@2026-10-30c`, tercatat di `ai_calls.prompt_version`; contoh di prompt memakai pola tanpa fakta domain agar tidak bocor ke jawaban): bila sumber berbeda
  tentang fakta yang sama —
  - label memutuskan (ada yang BERLAKU dan ada yang DIGANTI): jawab dengan yang BERLAKU, sebut yang lain
    sebagai aturan lama yang "sudah diganti", kutip keduanya;
  - label tidak memutuskan: jangan memilih, sebut kedua versi beserta sumbernya, `perlu_petugas: true`
    dengan `alasan_petugas: "sumber_berbeda"`;
  - model **tidak boleh** menyimpulkan aturan mana yang lebih baru dari tahun, nomor, atau isi teks.
- **Pengaman di server**: bila model menandai `beda_sumber` tetapi label sumber yang dikutipnya tidak
  memutuskan (ada yang `belum_diketahui`, atau tidak ada pasangan berlaku–diganti), jawaban kedua versi
  tetap ditampilkan lalu percakapan diserahkan ke petugas dengan alasan `sumber_berbeda`.
- **Label hanya dari naskah resmi yang terbaca** (JDIH Kementerian, peraturan.bpk.go.id). Bila naskah tidak
  dapat dibaca, status tetap `belum_diketahui`. Ringkasan pihak ketiga dan berita bukan dasar pengisian.
- **Uji**: label per status, aturan "label memutuskan", alur ke petugas vs tetap dijawab, label ikut
  terkirim ke model (termasuk artikel dari indeks pencarian). Paket uji `sigap:uji-asisten` memberi kasus
  batas usia tanda `konflik`: jawaban wajib memuat 53 dan menyebut 49 sebagai aturan lama bila label
  memutuskan, atau diteruskan ke petugas bila belum.

## 6. Non-Functional Requirements

| Aspek | Sasaran |
|---|---|
| Kecepatan terima pesan | `POST /chat/pesan` P95 < 300 ms (tanpa model) |
| Kecepatan jawaban TARA | P95 < 12 dtk dengan model sungguhan; > 15 dtk tampil pesan "masih menyiapkan" |
| Ketersediaan | Penyedia AI mati → chat tetap jalan (serah ke petugas) dalam < 2 dtk setelah sirkuit terbuka |
| Keamanan | Tidak ada endpoint baru yang publik selain yang sudah ada; antrean `ai` hanya di jaringan internal Compose |
| Privasi | 0 data pribadi ke model (diuji); `ai_calls` tanpa teks |
| Biaya | Anggaran harian terpasang; biaya per percakapan terlihat di Kesehatan AI |
| Pemeliharaan | Uji arsitektur menjaga §4.2; kelas modul Assistant ≤ 250 baris; setiap modul punya folder tes |
| Kompatibilitas | Semua tes yang ada tetap hijau di setiap tahap; migrasi hanya menambah |

## 7. Perubahan model data

| Perubahan | Tahap | Catatan |
|---|---|---|
| Tabel `ai_calls` | 0 | Indeks `(task, created_at)`, `(status, created_at)`; dapat dipangkas |
| Kolom `chat_conversations.ai_pending_at` (nullable) | 2 | Menandai TARA sedang menyiapkan jawaban (indikator mengetik, deteksi macet) |
| Kolom `dasar_hukum`, `tanggal_dasar`, `status_dasar`, `diganti_oleh` di `knowledge_sources` & `knowledge_articles` | FR-AI-11 | Label aturan berlaku/lama untuk jawaban TARA |
| Tidak ada perubahan tabel lain | — | Tabel Referral/ContactCenter tetap; tabel Knowledge hanya bertambah kolom FR-AI-11; kepemilikannya ditegaskan |

## 8. Kontrak antarmodul (sketsa)

```php
// Modules/Ai
final class AiGateway {
    public function run(AiTask $task, array $input, ?AiContext $ctx = null): AiResult;
}
enum AiTask: string { case Jawab = 'jawab'; case UsulArtikel = 'usul_artikel'; case SaranTiket = 'saran_tiket'; }
final class AiResult {   // readonly
    public string $status;      // ok|fallback|skipped|error
    public array  $data;        // sudah divalidasi skema tugas
    public ?string $reason;
}

// Modules/Knowledge
interface KnowledgeSearch {
    /** @return Collection<int, SourceSnippet> artikel terbit + kutipan Sumber Resmi */
    public function sources(string $question): Collection;
    public function terms(string $text): array;
}

// Modules/Assistant
final class ResponsePolicy {
    public function decide(AiResult $result, PolicyContext $ctx): Decision; // tanpa DB, tanpa model
}
```

## 9. Konfigurasi & deploy

**Variabel baru** (`deploy/docker/.env.example`, semua opsional dengan bawaan aman):

| Variabel | Bawaan | Arti |
|---|---|---|
| `AI_ASYNC` | `true` | Jawaban lewat antrean (`false` = jalur sinkron lama) |
| `AI_QUEUE` | `ai` | Nama antrean tugas AI |
| `AI_DAILY_TOKEN_BUDGET` | `0` | Batas token per hari (0 = tanpa batas) |
| `AI_BREAKER_THRESHOLD` / `AI_BREAKER_COOLDOWN` | `5` / `300` | Pemutus sirkuit |
| `AI_MAX_CALLS_PER_CONVERSATION_HOUR` | `20` | Batas per percakapan |
| `AI_MODEL_SARAN_TIKET`, `AI_MODEL_USUL_ARTIKEL` | kosong | Model khusus per tugas |
| `AI_LOG_RETENTION_DAYS` | `90` | Retensi `ai_calls` |

**Compose** (`deploy/docker/compose.yml`): tambah satu service **`queue-ai`** dari image `sigap-app`
yang sama, perintah `php artisan queue:work --queue=ai --sleep=1 --tries=1 --timeout=60`,
`restart: unless-stopped`. Ini **bukan** microservice: kode, image, dan database sama; hanya prosesnya
dipisah agar jawaban TARA tidak antre di belakang pemrosesan PDF.

**Rollback:** `AI_ASYNC=false` (kembali ke sinkron) atau `AI_ENABLED=false` (live chat biasa), lalu
`bash scripts/deploy.sh --no-pull`. Kode: `scripts/deploy.sh --rollback` (migrasi hanya menambah).

## 10. Uji yang wajib ada

- **Uji arsitektur** (tes PHPUnit yang memindai pernyataan `use` per namespace, karena proyek memakai
  PHPUnit, bukan Pest): §4.2 dan "hanya `Modules\Ai` yang memakai `LlmClient`".
- **ResponsePolicy**: satu tes per cabang keputusan (tanpa DB).
- **Gateway**: penyamaran per tugas, coba ulang, sirkuit terbuka/tertutup, anggaran habis, JSON rusak →
  cadangan, `ai_calls` tercatat tanpa teks.
- **Asinkron**: pesan diterima < 300 ms (tanpa model), job idempoten, urutan per percakapan, dilewati
  bila diambil petugas, gagal → serah ke petugas, `AI_ASYNC=false` tetap lulus tes lama.
- Tes yang ada saat ini (asisten, rujukan, pengetahuan, saran tiket, kualitas pencarian) tetap hijau.

## 11. Rencana bertahap

Perkiraan untuk 1 pengembang dibantu AI agent; setiap tahap dapat dirilis sendiri.

| Tahap | Isi | Perkiraan | Selesai bila |
|---|---|---|---|
| **0. Pengaman** | Tabel `ai_calls` + pembungkus pencatat di sekitar `LlmClient` yang ada; ambang `sigap:uji-asisten`; kerangka uji arsitektur | 1–2 hari | Setiap panggilan tercatat; perilaku tidak berubah; uji kualitas bisa gagal di CI |
| **1. AI Gateway** | `AiGateway`, `AiTask`, prompt berversi, penyamaran terpusat, coba ulang, sirkuit, anggaran; 3 pemanggil pindah | 2–3 hari | Tidak ada `LlmClient` di luar modul Ai; tes FR-AI-01/03/10 hijau |
| **2. Jawaban asinkron** | Event + job `RespondToMessage`, antrean `ai`, `ai_pending_at`, indikator mengetik, service `queue-ai`, saklar `AI_ASYNC` | 3–4 hari | NFR kecepatan terpenuhi di staging; rollback `AI_ASYNC=false` teruji |
| **3. Asisten dipecah** | `Consultation`, `ResponsePolicy`, `ReplyComposer`, teks ke `lang/id/asisten.php` | 3–4 hari | `AssistantService` lama dihapus; kelas ≤ 250 baris; balasan identik (tes lama) |
| **4. Batas modul** | Pindah ke `app/Modules/*`, kontrak §8, event ContactCenter, uji arsitektur ditegakkan | 2–3 hari | Uji arsitektur hijau tanpa pengecualian |
| **5. Pemantauan** | Halaman Kesehatan AI, laporan uji kualitas mingguan, notifikasi anggaran | 2 hari | Super Admin melihat angka §FR-AI-08 dari data nyata |

Urutan dapat diubah satu hal: **Tahap 2 boleh didahulukan** bila AI sungguhan dinyalakan sebelum
refaktor selesai, karena T1 paling berdampak ke warga.

## 12. Kriteria penerimaan (keseluruhan)

1. Mematikan penyedia AI (mis. `AI_BASE_URL` salah) → warga tetap mendapat pesan serah ke petugas
   dalam < 2 dtk setelah sirkuit terbuka; halaman lain tidak melambat.
2. 50 pesan bersamaan dengan model sungguhan → `POST /chat/pesan` P95 < 300 ms; seluruh jawaban terkirim.
3. `sigap:uji-asisten` dengan model produksi memenuhi ambang FR-AI-07.
4. Kesehatan AI menampilkan panggilan, galat, P95, dan token hari ini.
5. Tidak ada NIK/HP/surel di permintaan ke penyedia (diuji dan diperiksa pada log penyedia saat staging).
6. Semua tes lama + baru hijau; uji arsitektur hijau.

## 13. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Refaktor mengubah perilaku TARA tanpa sengaja | Tahap 0 dulu (pengaman), tes lama sebagai jaring; perubahan teks dilarang di tahap refaktor |
| Worker `queue-ai` mati → jawaban tidak terkirim | Health check Compose; `ai_pending_at` > 90 dtk dianggap macet dan diserahkan ke petugas oleh `sigap:ai-macet` yang berjalan tiap 15 dtk (serah 90–105 dtk setelah pesan; ambang mencakup waktu antre sehingga tidak diturunkan). Job yang melewati timeout 60 dtk gagal lebih dulu lewat `failOnTimeout` → pesan serah ke petugas oleh scheduler; `AI_ASYNC=false` sebagai jalan pintas |
| Urutan jawaban kacau saat warga mengirim beruntun | Kunci per percakapan + jawab pesan terbaru dengan riwayat lengkap |
| Biaya melonjak (spam, model mahal) | Anggaran harian, batas per percakapan, model per tugas |
| Kebijakan data penyedia luar | Penyamaran wajib + keputusan penyedia oleh pemilik/Pusdatin (§14) |
| Antrean `database` lambat saat sangat ramai | Pantau di Kesehatan AI; Redis dipertimbangkan hanya bila terbukti perlu (di luar cakupan) |

## 14. Keputusan yang perlu dijawab pemilik

| # | Pertanyaan | Usulan |
|---|---|---|
| K1 | Penyedia produksi: OpenCode Zen, Sumopod, atau server GPU kementerian? | Mulai dengan penyedia API + penyamaran; ajukan server GPU ke Pusdatin bila volume/kebijakan menuntut |
| K2 | Persetujuan pengiriman data (sudah disamarkan) ke penyedia di luar negeri | Minta konfirmasi Pusdatin/biro hukum sebelum `AI_ENABLED=true` di produksi |
| K3 | Anggaran token harian | Tetapkan setelah 1 minggu staging dengan data pemakaian dari `ai_calls` |
| K4 | Retensi `ai_calls` | 90 hari |
| K5 | Apakah aplikasi lain (PPID/TARA situs PPID, SIBARDUKTRANS) akan memakai AI & pengetahuan SIGAP? | Belum; bila ya, buka API baca-saja untuk modul Knowledge dan Gateway, tetap di aplikasi yang sama |

## Lampiran A — Peta berkas sekarang → modul

| Berkas sekarang | Modul tujuan |
|---|---|
| `app/Services/Ai/{LlmClient,OpenAiCompatibleClient,FakeLlmClient,AiException,PiiMasker,Prompts}.php` | Ai |
| `app/Services/Ai/AssistantService.php` | Assistant (dipecah: Consultation, ResponsePolicy, ReplyComposer) |
| `app/Services/Ai/TicketSuggester.php` | Assistant (`TicketSuggestions`) |
| `app/Services/Ai/ServiceHours.php`, `app/Services/ChatService.php`, `app/Services/ContactCenterStats.php` | ContactCenter |
| `app/Services/Knowledge/*`, `app/Jobs/{ProcessKnowledgeDocument,SyncKnowledgeSource}.php` | Knowledge |
| `app/Services/{ReferralService,PortalDirectory,PortalHealthCheck}.php` | Referral |
| `app/Console/Commands/UjiAsistenCommand.php`, `database/data/uji-asisten.php` | Assistant (alat uji) |
