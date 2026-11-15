--
-- PostgreSQL database dump
--

\restrict ccuji

-- Dumped from database version 16.16 (Homebrew)
-- Dumped by pg_dump version 16.16 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, priority_default, sla_days, is_active, created_at, updated_at) FROM stdin;
1	Infrastruktur Dasar	infrastruktur-dasar	umum	14	t	2026-11-14 00:16:46	2026-11-14 00:16:46
2	Tata Kelola Lahan	tata-kelola-lahan	umum	14	t	2026-11-14 00:16:46	2026-11-14 00:16:46
3	Bantuan Sosial	bantuan-sosial	umum	14	t	2026-11-14 00:16:46	2026-11-14 00:16:46
4	Layanan Data / TIK	layanan-data-tik	umum	14	t	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channels (id, type, name, account_name, url, status, config, last_synced_at, created_at, updated_at) FROM stdin;
1	sosmed	@kementrans.ri	@kementrans.ri	https://www.instagram.com/kementrans.ri/	aktif	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
2	kantor	Kanal Kantor Pemerintahan	\N	\N	aktif	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
3	nasional	SP4N-LAPOR!	\N	https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi	aktif	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
4	nasional	Whistleblowing System	Inspektorat Jenderal	https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang	aktif	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
5	internal	Pengaduan Internal Pegawai	\N	\N	aktif	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regions (id, code, name, province, latitude, longitude, geometry, infrastructure_status, kk_count, is_active, created_at, updated_at) FROM stdin;
1	KWS-001	SP1 Merauke	Papua Selatan	-8.499100	140.401100	\N	Memadai	500	t	2026-11-14 00:16:46	2026-11-14 00:16:46
2	KWS-002	SP3 Bulungan	Kalimantan Utara	2.833300	117.366700	\N	Berkembang	350	t	2026-11-14 00:16:46	2026-11-14 00:16:46
3	KWS-003	SP2 Luwu Timur	Sulawesi Selatan	-2.583300	121.100000	\N	Berkembang	420	t	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.units (id, code, name, short_name, parent_id, level, email, is_active, sort, created_at, updated_at) FROM stdin;
1	SETJEN	Sekretariat Jenderal	Setjen	\N	eselon_1	\N	t	1	2026-11-14 00:16:46	2026-11-14 00:16:46
2	SETJEN-RENKERMAS	Biro Perencanaan, Kerja Sama, dan Hubungan Masyarakat	Biro Renkermas	1	eselon_2	\N	t	1	2026-11-14 00:16:46	2026-11-14 00:16:46
3	SETJEN-KEUBMN	Biro Keuangan dan Barang Milik Negara	Biro Keuangan & BMN	1	eselon_2	\N	t	2	2026-11-14 00:16:46	2026-11-14 00:16:46
4	SETJEN-OSDMRB	Biro Organisasi, Sumber Daya Manusia, dan Reformasi Birokrasi	Biro OSDM & RB	1	eselon_2	\N	t	3	2026-11-14 00:16:46	2026-11-14 00:16:46
5	SETJEN-HUKUM	Biro Hukum	\N	1	eselon_2	\N	t	4	2026-11-14 00:16:46	2026-11-14 00:16:46
6	SETJEN-UMUM	Biro Umum dan Layanan Pengadaan	Biro Umum & Pengadaan	1	eselon_2	\N	t	5	2026-11-14 00:16:46	2026-11-14 00:16:46
7	DITJEN-PPKT	Direktorat Jenderal Pembangunan dan Pengembangan Kawasan Transmigrasi	Ditjen PPKTrans	\N	eselon_1	\N	t	2	2026-11-14 00:16:46	2026-11-14 00:16:46
8	PPKT-SET	Sekretariat Direktorat Jenderal Pembangunan dan Pengembangan Kawasan Transmigrasi	Setditjen PPKTrans	7	eselon_2	\N	t	1	2026-11-14 00:16:46	2026-11-14 00:16:46
9	PPKT-RENWUJUD	Direktorat Perencanaan Perwujudan Kawasan Transmigrasi	\N	7	eselon_2	\N	t	2	2026-11-14 00:16:46	2026-11-14 00:16:46
10	PPKT-BANGKAWASAN	Direktorat Pembangunan Kawasan Transmigrasi	\N	7	eselon_2	\N	t	3	2026-11-14 00:16:46	2026-11-14 00:16:46
11	PPKT-PERSEBARAN	Direktorat Fasilitasi Penataan Persebaran Penduduk di Kawasan Transmigrasi	\N	7	eselon_2	\N	t	4	2026-11-14 00:16:46	2026-11-14 00:16:46
12	PPKT-SPPSKP	Direktorat Pengembangan Satuan Permukiman dan Pusat Satuan Kawasan Pengembangan	\N	7	eselon_2	\N	t	5	2026-11-14 00:16:46	2026-11-14 00:16:46
13	PPKT-KEMBANGKAWASAN	Direktorat Pengembangan Kawasan Transmigrasi	\N	7	eselon_2	\N	t	6	2026-11-14 00:16:46	2026-11-14 00:16:46
14	DITJEN-PEPMT	Direktorat Jenderal Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi	Ditjen PEPMTrans	\N	eselon_1	\N	t	3	2026-11-14 00:16:46	2026-11-14 00:16:46
15	PEPMT-SET	Sekretariat Direktorat Jenderal Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi	Setditjen PEPMTrans	14	eselon_2	\N	t	1	2026-11-14 00:16:46	2026-11-14 00:16:46
16	PEPMT-RENTEK	Direktorat Perencanaan Teknis Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi	\N	14	eselon_2	\N	t	2	2026-11-14 00:16:46	2026-11-14 00:16:46
17	PEPMT-KELEMBAGAAN	Direktorat Pengembangan Kelembagaan Ekonomi Transmigrasi	\N	14	eselon_2	\N	t	3	2026-11-14 00:16:46	2026-11-14 00:16:46
18	PEPMT-PRODUK	Direktorat Pengembangan Produk Unggulan Transmigrasi	\N	14	eselon_2	\N	t	4	2026-11-14 00:16:46	2026-11-14 00:16:46
19	PEPMT-PROMOSI	Direktorat Promosi dan Pemasaran Produk Unggulan Transmigrasi	\N	14	eselon_2	\N	t	5	2026-11-14 00:16:46	2026-11-14 00:16:46
20	PEPMT-PEMBERDAYAAN	Direktorat Pemberdayaan Masyarakat Transmigrasi	\N	14	eselon_2	\N	t	6	2026-11-14 00:16:46	2026-11-14 00:16:46
21	ITJEN	Inspektorat Jenderal	Itjen	\N	eselon_1	\N	t	4	2026-11-14 00:16:46	2026-11-14 00:16:46
22	ITJEN-SET	Sekretariat Inspektorat Jenderal	\N	21	eselon_2	\N	t	1	2026-11-14 00:16:46	2026-11-14 00:16:46
23	ITJEN-IR1	Inspektorat I	\N	21	eselon_2	\N	t	2	2026-11-14 00:16:46	2026-11-14 00:16:46
24	ITJEN-IR2	Inspektorat II	\N	21	eselon_2	\N	t	3	2026-11-14 00:16:46	2026-11-14 00:16:46
25	PUS-STRAJAK	Pusat Strategi Kebijakan Transmigrasi	Pusstrajak	\N	eselon_2	\N	t	5	2026-11-14 00:16:46	2026-11-14 00:16:46
26	PUS-BANGSDM	Pusat Pengembangan Sumber Daya Manusia Transmigrasi	Pusbang SDM	\N	eselon_2	\N	t	6	2026-11-14 00:16:46	2026-11-14 00:16:46
27	PUS-DATIN	Pusat Data dan Informasi Transmigrasi	Pusdatin	\N	eselon_2	\N	t	7	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, nik, username, name, email, phone, role, region_id, unit, is_active, email_verified_at, password, remember_token, created_at, updated_at, nik_hash, registered_by, activated_at, unit_id) FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tickets (id, ticket_no, title, description, status, priority, impact, visibility, latitude, longitude, attachment_path, is_internal, category_id, region_id, channel_id, assignee_id, reporter_id, reporter_name, reporter_nik, reporter_email, reporter_phone, sla_due_at, responded_at, resolved_at, created_at, updated_at, deleted_at, ews_notified_at, source, source_url, received_by, reporter_nip, reporter_unit, location, reporter_nik_hash, lookup_token, province, reporter_unit_id, unit_id, disposed_at, review_requested_at, review_reason, reviewed_at, reviewed_by, survey_reminded_at) FROM stdin;
\.


--
-- Data for Name: chat_conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_conversations (id, user_id, guest_token, subject, last_message_at, unread_admin, unread_user, created_at, updated_at, guest_name, handled_by, handoff_at, handoff_reason, ai_summary, reference, contact, assigned_to, outcome, closed_at, closed_by, ticket_id, data_verified_at, ai_pending_at, province, location) FROM stdin;
\.


--
-- Data for Name: account_activations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_activations (id, user_id, conversation_id, created_by, purpose, token_hash, expires_at, used_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_logs (id, user_id, username, action, subject_type, subject_id, description, properties, ip_address, user_agent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_calls; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_calls (id, task, prompt_version, provider, model, status, latency_ms, prompt_tokens, completion_tokens, conversation_id, error_code, created_at) FROM stdin;
\.


--
-- Data for Name: ai_quality_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_quality_runs (id, model, with_model, passed, retrieval_hits, retrieval_total, classification_hits, classification_total, unsourced, failed_calls, number_rejections, median_ms, p95_ms, failures, duration_s, created_at) FROM stdin;
\.


--
-- Data for Name: cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cache (key, value, expiration) FROM stdin;
\.


--
-- Data for Name: cache_locks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cache_locks (key, owner, expiration) FROM stdin;
\.


--
-- Data for Name: channel_sync_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_sync_logs (id, channel_id, channel, pulled_count, status, message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, conversation_id, sender_id, sender_type, body, read_at, created_at, updated_at, meta, feedback) FROM stdin;
\.


--
-- Data for Name: failed_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.failed_jobs (id, uuid, connection, queue, payload, exception, failed_at) FROM stdin;
\.


--
-- Data for Name: job_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_batches (id, name, total_jobs, pending_jobs, failed_jobs, failed_job_ids, options, cancelled_at, created_at, finished_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.jobs (id, queue, payload, attempts, reserved_at, available_at, created_at) FROM stdin;
\.


--
-- Data for Name: knowledge_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_documents (id, original_name, path, size, pages, status, error, proposals, uploaded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: knowledge_articles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_articles (id, title, body, category, source, source_ref, status, review_at, knowledge_document_id, created_by, updated_by, used_count, helpful_count, unhelpful_count, created_at, updated_at, keywords, source_url, dasar_hukum, tanggal_dasar, status_dasar, diganti_oleh) FROM stdin;
1	Bagaimana cara membuat pengaduan di Contact Center?	1. Buka menu Buat Pengaduan.\n2. Pilih kategori dan kawasan, lalu tulis uraian masalah.\n3. Lampirkan foto atau dokumen bila ada, dan tandai titik lokasi.\n4. Kirim. Anda akan menerima nomor tiket berformat TKT-YYMMDD-XXXXXX untuk melacak perkembangannya.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
2	Bagaimana cara melacak tiket pengaduan?	Buka menu Lacak Tiket, lalu masukkan nomor tiket Anda (contoh: TKT-261012-7KQ4MZ). Anda juga dapat mengetik nomor tiket langsung di chat Asisten Contact Center. Nama pelapor selalu ditampilkan tersamar demi privasi.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
3	Apa arti status tiket?	Menunggu: tiket baru diterima.\nDiverifikasi: petugas memeriksa kelengkapan dan kebenaran laporan.\nDiproses: laporan sedang ditindaklanjuti.\nSelesai: penanganan selesai; Anda dapat mengisi survei kepuasan.\nDitolak: laporan tidak dapat diproses, misalnya karena data tidak lengkap. Alasannya dapat dilihat di halaman lacak.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
4	Berapa lama pengaduan ditangani?	Batas waktu penanganan ditentukan oleh tingkat dampak laporan: dampak kritis 3 hari kerja, dampak tinggi 7 hari kerja, dampak sedang dan rendah 14 hari kerja. Batas waktu tiket Anda tercantum di halaman lacak.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
5	Apakah saya bisa mengadu tanpa menyebutkan identitas?	Bisa. Saat membuat pengaduan, pilih klasifikasi Anonim agar nama Anda tidak ditampilkan, atau Rahasia agar laporan hanya dapat dilihat oleh Anda dan petugas yang berwenang.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
6	Kapan sebaiknya melapor ke SP4N-LAPOR! atau ke Inspektorat Jenderal?	Gunakan SP4N-LAPOR! (sp4n.lapor.go.id) bila masalah Anda juga menyangkut instansi lain, misalnya pemerintah daerah atau ATR/BPN; Anda dapat memilih agar identitas dirahasiakan. Untuk dugaan pungutan liar, penyalahgunaan wewenang, atau pelanggaran oleh pegawai Kementerian Transmigrasi, laporkan ke PPID (ppid@transmigrasi.go.id, WhatsApp 0812-9001-9358) yang meneruskannya ke Inspektorat Jenderal paling lambat 30 hari kerja. Gratifikasi dilaporkan ke Gratifikasi Online KPK (gol.kpk.go.id).	Rujukan	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
7	Bagaimana cara masuk sebagai warga?	Belum punya akun? Pilih menu Masuk lalu klik "Daftar di sini", isi NIK, nama, email, dan kata sandi, kemudian klik tautan verifikasi yang dikirim ke email Anda. Setelah itu masuk dengan NIK dan kata sandi. Tidak punya email? Tulis di chat ini dan minta dibantu petugas; petugas dapat membuatkan akun untuk Anda cukup dengan NIK dan nama sesuai KTP. Lupa kata sandi? Klik "Lupa kata sandi?" di halaman Masuk untuk menerima tautan atur ulang lewat email. Hak akses admin hanya diberikan kepada pegawai yang terdaftar.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
8	Saya lupa kata sandi dan tidak punya email, bagaimana?	Tekan "Bicara dengan petugas" di chat ini. Petugas akan menanyakan NIK dan nomor HP yang dulu Anda daftarkan. Bila cocok, Anda menerima tombol "Buat kata sandi baru" di chat; tekan tombol itu, buat kata sandi baru, dan Anda langsung masuk. Petugas tidak akan pernah menanyakan kata sandi Anda. Bila akun Anda punya email aktif, Anda juga bisa memakai menu "Lupa kata sandi?" di halaman Masuk.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
9	Bagaimana cara menghapus dokumen yang sudah diunggah?	Demi akuntabilitas, dokumen yang sudah dikirim tidak dapat dihapus sendiri. Silakan hubungi petugas melalui chat dengan menyebutkan nomor tiket Anda.	Layanan Contact Center	Panduan Layanan Contact Center	\N	terbit	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	\N	\N	belum_diketahui	\N
10	Bagaimana cara meminta informasi publik dari Kementerian Transmigrasi?	Permohonan informasi publik dilayani PPID Kementerian Transmigrasi, bukan melalui Contact Center.\n1. Isi formulir Permohonan Informasi di ppid.transmigrasi.go.id, atau datang langsung ke ruang layanan PPID pada jam layanan.\n2. Siapkan identitas (KTP), rincian informasi yang diminta, tujuan penggunaan, serta cara memperoleh dan cara pengiriman informasi yang diinginkan.\n3. Simpan nomor registrasi yang diberikan untuk melacak status permohonan.\n4. PPID memeriksa kelengkapan, menelusuri informasi ke unit kerja terkait, lalu memberi tanggapan tertulis.	Informasi Publik	PPID Kementerian Transmigrasi — Prosedur Permohonan	Dasar: UU 14/2008	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	permohonan informasi, minta data, dokumen, salinan, PPID, keterbukaan informasi	https://ppid.transmigrasi.go.id/standar-layanan/prosedur-permohonan	\N	\N	belum_diketahui	\N
11	Berapa lama permohonan informasi publik dijawab?	PPID memberi tanggapan tertulis paling lambat 10 hari kerja sejak permohonan diterima lengkap. Bila belum dapat dipenuhi, jangka waktunya dapat diperpanjang 7 hari kerja dengan pemberitahuan tertulis disertai alasan. Permohonan daring dapat diajukan kapan saja, tetapi diproses pada hari kerja.	Informasi Publik	PPID Kementerian Transmigrasi — Waktu & Biaya Layanan	Dasar: UU 14/2008	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	jangka waktu, hari kerja, perpanjangan, tanggapan, jawaban permohonan	https://ppid.transmigrasi.go.id/standar-layanan/waktu-biaya	\N	\N	belum_diketahui	\N
12	Apakah meminta informasi publik dikenai biaya?	Pengajuan permohonan informasi melalui portal PPID tidak dipungut biaya. Informasi diutamakan diberikan dalam bentuk salinan digital melalui email. Bila pemohon meminta salinan fisik, biaya penggandaan dan pengiriman dapat dibebankan kepada pemohon sesuai standar biaya yang berlaku, dan PPID memberitahukannya lebih dulu sebelum diproses.	Informasi Publik	PPID Kementerian Transmigrasi — Waktu & Biaya Layanan	Dasar: UU 14/2008, PP 61/2010	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	gratis, biaya, bayar, fotokopi, salinan fisik, ongkos kirim	https://ppid.transmigrasi.go.id/standar-layanan/waktu-biaya	\N	\N	belum_diketahui	\N
13	Bagaimana cara melacak status permohonan informasi di PPID?	Buka menu Cek Status Pengajuan di portal PPID Kementerian Transmigrasi, lalu masukkan nomor registrasi dan email yang Anda gunakan saat mengajukan permohonan. Nomor tiket Contact Center tidak berlaku untuk permohonan informasi PPID.	Informasi Publik	PPID Kementerian Transmigrasi — FAQ	Layanan Informasi Publik	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	lacak permohonan, nomor registrasi, cek status PPID	https://ppid.transmigrasi.go.id/permohonan/lacak	\N	\N	belum_diketahui	\N
14	Bagaimana jika permohonan informasi saya ditolak atau tidak dijawab?	Anda dapat mengajukan keberatan kepada Atasan PPID (Sekretaris Jenderal Kementerian Transmigrasi).\n1. Ajukan melalui menu Pengajuan Keberatan di portal PPID, paling lambat 30 hari kerja sejak jawaban diterima atau sejak batas waktu tanggapan terlampaui.\n2. Isi formulir keberatan dan simpan tanda terima sebagai bukti.\n3. Atasan PPID menanggapi paling lambat 30 hari kerja sejak keberatan diajukan, dan Anda menerima keputusan tertulis.	Informasi Publik	PPID Kementerian Transmigrasi — Prosedur Keberatan	Dasar: Perki 1/2021	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	keberatan, ditolak, tidak dijawab, banding, Atasan PPID, Sekretaris Jenderal	https://ppid.transmigrasi.go.id/standar-layanan/prosedur-keberatan	\N	\N	belum_diketahui	\N
15	Bagaimana jika saya tidak puas dengan keputusan Atasan PPID?	1. Ajukan penyelesaian sengketa informasi ke Komisi Informasi paling lambat 14 hari kerja sejak keputusan Atasan PPID.\n2. Komisi Informasi memproses pengajuan paling lambat 14 hari kerja dan menyelesaikannya melalui mediasi; bila tidak tercapai kesepakatan, dilanjutkan ajudikasi.\n3. Bila tidak menerima hasil ajudikasi, nyatakan penolakan secara tertulis, lalu Anda dapat mengajukan gugatan ke pengadilan paling lambat 14 hari kerja sejak putusan Komisi Informasi.	Informasi Publik	PPID Kementerian Transmigrasi — Prosedur Keberatan	Dasar: Perki 1/2021	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	sengketa informasi, Komisi Informasi, mediasi, ajudikasi, gugatan pengadilan	https://ppid.transmigrasi.go.id/standar-layanan/prosedur-keberatan	\N	\N	belum_diketahui	\N
16	Informasi apa yang dikecualikan dan tidak dapat diberikan?	Informasi yang dikecualikan adalah informasi yang bila dibuka dapat, antara lain, menghambat penegakan hukum, mengganggu perlindungan hak kekayaan intelektual, atau membahayakan pertahanan dan keamanan negara, serta kategori lain sesuai Pasal 17 UU 14/2008. Setiap penolakan atas informasi yang dikecualikan wajib disertai alasan tertulis berdasarkan uji konsekuensi.	Informasi Publik	PPID Kementerian Transmigrasi — FAQ	Pasal 17 UU 14/2008	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	dikecualikan, rahasia, tidak boleh dibuka, uji konsekuensi, Pasal 17	https://ppid.transmigrasi.go.id/faq	\N	\N	belum_diketahui	\N
17	Apa saja jenis informasi publik dan di mana daftarnya?	Informasi publik terdiri atas informasi yang wajib diumumkan secara berkala, informasi yang wajib diumumkan serta-merta, informasi yang wajib tersedia setiap saat, dan informasi yang dikecualikan. Tiga jenis pertama dapat ditelusuri di menu Informasi Publik (Daftar Informasi Publik) portal PPID Kementerian Transmigrasi, lengkap dengan pencarian dan filter kategori.	Informasi Publik	PPID Kementerian Transmigrasi — FAQ	Informasi Publik	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	informasi berkala, serta merta, setiap saat, daftar informasi publik, DIP	https://ppid.transmigrasi.go.id/faq	\N	\N	belum_diketahui	\N
18	Apa itu PPID dan siapa pejabatnya di Kementerian Transmigrasi?	PPID (Pejabat Pengelola Informasi dan Dokumentasi) adalah pejabat yang bertanggung jawab atas penyimpanan, pendokumentasian, penyediaan, dan pelayanan informasi di badan publik. Di Kementerian Transmigrasi, Atasan PPID adalah Sekretaris Jenderal dan PPID Utama dijabat Kepala Biro Perencanaan, Kerja Sama, dan Hubungan Masyarakat. PPID Pelaksana berada di Ditjen Pembangunan dan Pengembangan Kawasan Transmigrasi, Ditjen Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi, serta Inspektorat Jenderal.	Informasi Publik	PPID Kementerian Transmigrasi — FAQ	PPID	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	pejabat pengelola informasi, PPID utama, PPID pelaksana, struktur PPID	https://ppid.transmigrasi.go.id/faq	\N	\N	belum_diketahui	\N
19	Kapan jam layanan dan bagaimana menghubungi PPID Kementerian Transmigrasi?	Jam layanan langsung: Senin–Jumat, 08.00–15.00 WIB (tidak tersedia pada hari libur nasional dan cuti bersama). Permohonan daring dapat diajukan kapan saja.\n- Portal: ppid.transmigrasi.go.id\n- Telepon: 021-7994372\n- Email: ppid@transmigrasi.go.id\n- WhatsApp: tersedia melalui tombol di portal PPID\n- Alamat: Jl. TMP Kalibata No. 17, Rawajati, Pancoran, Jakarta Selatan 12750	Informasi Publik	PPID Kementerian Transmigrasi — Kanal Layanan	Kanal Layanan; Waktu & Biaya	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	jam buka, alamat kantor, nomor telepon, email PPID, WhatsApp, Kalibata	https://ppid.transmigrasi.go.id/standar-layanan/kanal-layanan	\N	\N	belum_diketahui	\N
20	Bagaimana melaporkan dugaan penyalahgunaan wewenang oleh pejabat Kementerian Transmigrasi?	Pengaduan dapat disampaikan dengan datang langsung ke information centre Kementerian Transmigrasi pada jam kerja, melalui email humas@transmigrasi.go.id, mengisi formulir daring atau tertulis kepada PPID, atau melalui surat/kotak pengaduan.\nPengaduan tertulis memuat identitas pelapor dan terlapor, perbuatan yang diduga dilanggar beserta waktu dan tempat kejadian, serta bukti atau keterangan pendukung. Pengaduan tanpa identitas lengkap tetap dapat ditindaklanjuti bila isinya logis dan memadai.\nPPID meneruskan pengaduan kepada Menteri, yang memprosesnya paling lambat 30 hari kerja dan mendisposisikannya kepada Inspektur Jenderal. Jawaban disampaikan kepada pelapor melalui PPID.	Pengaduan	PPID Kementerian Transmigrasi — Pengaduan Penyalahgunaan Wewenang	Standar Layanan	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	penyalahgunaan wewenang, pejabat nakal, pungli, Inspektorat Jenderal, whistleblowing	https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang	\N	\N	belum_diketahui	\N
21	Apa tugas dan fungsi Kementerian Transmigrasi?	Kementerian Transmigrasi bertugas menyelenggarakan urusan pemerintahan di bidang transmigrasi untuk membantu Presiden. Fungsinya antara lain:\n- merumuskan, menetapkan, dan melaksanakan kebijakan pembangunan dan pengembangan kawasan transmigrasi, serta pengembangan ekonomi dan pemberdayaan masyarakat transmigrasi;\n- bimbingan teknis dan supervisi urusan kementerian di daerah;\n- koordinasi, pembinaan, dan dukungan administrasi di lingkungan kementerian;\n- pengelolaan barang milik negara dan pengawasan pelaksanaan tugas di lingkungan kementerian.	Kelembagaan	Perpres 172/2024 tentang Kementerian Transmigrasi	Pasal 5 (tugas) dan Pasal 6 (fungsi)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	tugas kementerian, fungsi kementerian, Kementrans, Perpres 172/2024	https://ppid.transmigrasi.go.id/kementerian/tugas-fungsi	\N	\N	belum_diketahui	\N
22	Apa yang dimaksud dengan transmigrasi, transmigran, dan kawasan transmigrasi?	- Transmigrasi: perpindahan penduduk secara sukarela untuk meningkatkan kesejahteraan dan menetap di kawasan transmigrasi yang diselenggarakan oleh Pemerintah.\n- Transmigran: warga negara Republik Indonesia yang berpindah secara sukarela ke kawasan transmigrasi.\n- Kawasan transmigrasi: kawasan budi daya yang berfungsi sebagai permukiman dan tempat usaha masyarakat, berupa wilayah pengembangan transmigrasi atau lokasi permukiman transmigrasi.	Ketentuan Pokok	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 1 (UU 29/2009)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	pengertian, arti transmigrasi, definisi, permukiman transmigrasi	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
23	Apa saja jenis transmigrasi?	Ada tiga jenis transmigrasi:\n1. Transmigrasi Umum (TU): dilaksanakan Pemerintah dan/atau pemerintah daerah bagi penduduk yang mengalami keterbatasan dalam mendapatkan peluang kerja dan usaha.\n2. Transmigrasi Swakarsa Berbantuan (TSB): dirancang Pemerintah dan/atau pemerintah daerah dengan mengikutsertakan badan usaha sebagai mitra usaha transmigran, bagi penduduk yang berpotensi berkembang untuk maju.\n3. Transmigrasi Swakarsa Mandiri (TSM): prakarsa transmigran sendiri atas arahan, layanan, dan bantuan Pemerintah dan/atau pemerintah daerah, bagi penduduk yang telah memiliki kemampuan.\nKetiganya diselenggarakan melalui pola usaha pokok.	Ketentuan Pokok	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 1 & Pasal 6	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	jenis transmigrasi, TU, TSB, TSM, transmigrasi umum, swakarsa berbantuan, swakarsa mandiri, macam	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
24	Siapa yang boleh menjadi transmigran dan apa syaratnya?	- Setiap warga negara Republik Indonesia dapat ikut serta sebagai transmigran.\n- Keikutsertaan bersifat sukarela dan wajib memenuhi persyaratan yang ditetapkan.\n- Transmigran terdiri atas kepala keluarga beserta anggota keluarganya; untuk kepentingan tertentu Pemerintah dapat menetapkan pengecualian.\n- Rincian persyaratan dan pengecualiannya diatur dalam Peraturan Menteri, dan setiap calon transmigran diseleksi oleh Pemerintah.\nKelayakan seseorang tidak dapat dipastikan lewat chat; untuk ketentuan pendaftaran yang berlaku, tanyakan kepada petugas.	Ketentuan Pokok	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 10 & Pasal 27	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	syarat transmigran, persyaratan, daftar transmigrasi, ikut transmigrasi, calon transmigran, peserta, kepala keluarga	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
25	Apa saja persyaratan calon transmigran dari daerah asal?	Persyaratan calon Transmigran Karya Nusantara (TKN) daerah asal:\n1. Warga negara Indonesia yang memiliki KTP-el.\n2. Berkeluarga, dibuktikan dengan surat nikah dan KK. Boleh belum berkeluarga bila memiliki keahlian tertentu yang dibuktikan sertifikat (mis. tenaga kesehatan, tenaga pendidikan, jasa konstruksi, perbengkelan, las, kerajinan, pengolahan hasil pertanian).\n3. Berusia 19–53 tahun (48–53 tahun bagi purnabakti TNI/Polri).\n4. Diutamakan minimal lulusan SMP/sederajat.\n5. Sehat, dibuktikan surat keterangan dokter.\n6. Menyatakan tekad mengembangkan kehidupan di permukiman transmigrasi dengan surat pernyataan.\n7. Memiliki kemampuan mengembangkan usaha dan/atau budi daya di kawasan transmigrasi, dibuktikan sertifikat pelatihan dari lembaga pelatihan yang berwenang.\n8. Belum pernah bertransmigrasi, dibuktikan surat keterangan perangkat daerah bidang ketransmigrasian.\n9. Mengikuti seleksi dan pelatihan komponen cadangan (Komcad), dan lulus seleksi.	Pendaftaran Transmigran	SIBARDUKTRANS — Tata Cara Bertransmigrasi	Persyaratan TKN daerah asal	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	syarat transmigran, persyaratan calon transmigran, usia transmigran, umur, KTP, KK, surat nikah, surat sehat, belum berkeluarga, lajang, TKN, Komcad, sertifikat pelatihan, syarat peserta, syarat ikut transmigrasi, syarat menjadi transmigran	https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi	Permentrans 2/2024 tentang Penataan Persebaran Penduduk di Kawasan Transmigrasi (Pasal 6 ayat (3))	2024-12-09	berlaku	\N
26	Apa syarat penduduk setempat untuk menjadi transmigran lokal?	Penduduk yang tinggal di Satuan Permukiman (SP) Pugar dapat memperoleh perlakuan sebagai transmigran, baik yang memiliki tanah dan rumah, memiliki tanah tanpa rumah, maupun tidak memiliki keduanya. Syaratnya:\n1. Terdaftar dalam dokumen RTSP-Pugar.\n2. Memiliki KTP di permukiman yang akan dikembangkan menjadi SP-Pugar tersebut.\n3. Berkeluarga.\n4. Sudah tinggal menetap dan memanfaatkan tanah di permukiman itu paling singkat 2 tahun.\n5. Diutamakan minimal lulusan SMP/sederajat, dan sehat (surat keterangan dokter).\n6. Membuat surat pernyataan tekad, belum pernah bertransmigrasi, dan lulus seleksi.	Pendaftaran Transmigran	SIBARDUKTRANS — Tata Cara Bertransmigrasi	Persyaratan transmigran penduduk setempat	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	transmigran lokal, penduduk setempat, TPS, SP Pugar, RTSP, warga sekitar kawasan	https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi	Permentrans 2/2024 tentang Penataan Persebaran Penduduk di Kawasan Transmigrasi (Pasal 9 ayat (3))	2024-12-09	berlaku	\N
27	Di mana dan bagaimana cara mendaftar sebagai calon transmigran?	Pendaftaran dapat dilakukan di:\n- kantor desa/kelurahan domisili Anda;\n- perangkat daerah kabupaten/kota yang menangani transmigrasi, sesuai penerbit KTP Anda;\n- secara daring melalui SIBARDUKTRANS di https://sibarduktrans.transmigrasi.go.id/pendaftaran (buat akun dengan nomor telepon, email, dan kata sandi).\nSetelah terdaftar, perangkat daerah melakukan seleksi administrasi (pencocokan dokumen identitas dengan data kependudukan) lalu seleksi teknis berupa wawancara, tes tertulis, serta pemeriksaan kesehatan fisik dan mental. Pendaftar yang tidak hadir pada seleksi teknis dianggap mengundurkan diri. Calon yang ditetapkan berhak mengikuti pelatihan. Pendaftaran menjadi calon transmigran tidak dipungut biaya.	Pendaftaran Transmigran	SIBARDUKTRANS — Tata Cara Bertransmigrasi	Pendaftaran & Seleksi; formulir Pendaftaran Akun	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	cara daftar transmigrasi, tempat pendaftaran, daftar online, seleksi administrasi, seleksi teknis, wawancara, tes kesehatan, kantor desa, dinas transmigrasi	https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi	\N	\N	belum_diketahui	\N
28	Siapa yang diutamakan menjadi peserta Transmigrasi Umum?	Transmigrasi Umum diutamakan bagi penduduk yang berasal dari:\n1. wilayah berkepadatan penduduk tinggi, terbatas lapangan kerjanya, dan/atau berlahan kritis;\n2. daerah yang terkena bencana alam atau gangguan keamanan;\n3. perambah hutan dan peladang berpindah; dan\n4. wilayah yang tempat tinggalnya dijadikan proyek pembangunan untuk kepentingan umum.\nPrioritas ini tidak mengurangi hak setiap warga negara untuk ikut serta sebagai transmigran.	Ketentuan Pokok	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 12	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	prioritas, diutamakan, korban bencana, terdampak proyek, peladang berpindah	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
29	Bagaimana proses seleksi, pelatihan, dan penempatan calon transmigran?	1. Seleksi: Pemerintah menyeleksi setiap calon transmigran. Calon Transmigrasi Umum diseleksi berdasarkan prioritas penanganan masalah sosial ekonomi; calon Transmigrasi Swakarsa Berbantuan dan Swakarsa Mandiri diseleksi berdasarkan kesesuaian kesempatan kerja atau usaha dengan kesiapan dan keahliannya.\n2. Pelatihan: calon yang lulus seleksi diberi pendidikan dan pelatihan sesuai kebutuhan pengembangan.\n3. Penempatan: dilaksanakan setelah ada kepastian kesempatan kerja atau usaha dan tempat tinggal. Penempatan TU dilakukan Pemerintah dan/atau pemerintah daerah; TSB dapat mengikutsertakan badan usaha; TSM dilakukan sendiri oleh transmigran atau badan usaha penyedia lapangan kerja dan dapat dibantu pemerintah.	Ketentuan Pokok	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 27–30	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	seleksi, tes, pelatihan, diklat, penempatan, berangkat, tahapan, alur	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
30	Bantuan apa yang diterima transmigran Transmigrasi Umum?	Pada Transmigrasi Umum, transmigran berhak memperoleh bantuan dari Pemerintah dan/atau pemerintah daerah berupa:\n- perbekalan, pengangkutan dari daerah asal, dan penempatan di permukiman transmigrasi;\n- sarana produksi sesuai komoditas unggulan kawasan (misalnya pupuk dan benih untuk pertanian, peralatan tangkap untuk perikanan, ternak dan pakan untuk peternakan);\n- catu pangan untuk jangka waktu tertentu, yaitu bantuan natura dan/atau non-natura untuk meringankan biaya hidup agar transmigran dapat mulai bekerja atau berusaha di permukiman transmigrasi;\n- lahan usaha dan lahan tempat tinggal beserta rumah dengan status hak milik (pemberian hak milik dilakukan setelah transmigran memenuhi persyaratan yang ditetapkan Menteri).\nPelaksanaan pemberian bantuan diatur lebih lanjut dengan Peraturan Menteri. Hak bantuan perorangan hanya dapat diperiksa oleh petugas.	Hak & Kewajiban	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 7 ayat (2), Pasal 13 & penjelasan (UU 29/2009); Pasal 24 ayat (3) & penjelasan (UU 15/1997)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	bantuan transmigran, hak transmigran, jatah hidup, jadup, catu pangan, sarana produksi, bibit, pupuk, rumah	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
31	Bantuan apa yang diterima transmigran Transmigrasi Swakarsa Berbantuan?	Transmigran Swakarsa Berbantuan berhak memperoleh bantuan dari Pemerintah dan/atau pemerintah daerah berupa:\n(a) pelayanan perpindahan dan penempatan di permukiman transmigrasi (penampungan, pengangkutan, dan penempatan);\n(b) sarana usaha atau lahan usaha dengan status hak milik atau status lain sesuai pola usahanya. Lahan usaha di area Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik, sedangkan di luar area itu statusnya mengikuti status asal lahan;\n(c) lahan tempat tinggal beserta rumah dengan status hak milik;\n(d) sebagian kebutuhan sarana produksi; dan\n(e) bimbingan, pengembangan, dan perlindungan hubungan kemitraan usaha.\nTransmigran juga dapat memperoleh catu pangan, yang diberikan bila pada awal kedatangan belum berpenghasilan memadai. Menurut penjelasan undang-undang, bantuan ini diarahkan pada aset produksi tetap untuk mengurangi beban kredit transmigran.\nBadan usaha mitra membantu transmigran memperoleh akses modal, teknologi, dan manajemen usaha. Badan usaha mitra juga membantu perolehan kredit investasi dan modal kerja, bimbingan dan pelatihan usaha, informasi usaha, jaminan pemasaran hasil, jaminan pendapatan layak, bimbingan sosial, serta fasilitas umum dan sosial (Pasal 14 ayat (3)).	Hak & Kewajiban	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 8 dan Pasal 14 beserta penjelasannya (UU 29/2009)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	TSB, swakarsa berbantuan, badan usaha, kemitraan, plasma, modal, kredit	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
32	Bantuan apa yang diterima transmigran Transmigrasi Swakarsa Mandiri?	Transmigran Swakarsa Mandiri berhak memperoleh bantuan Pemerintah dan/atau pemerintah daerah berupa:\n1. pengurusan perpindahan dan penempatan di permukiman transmigrasi;\n2. bimbingan untuk mendapatkan lapangan kerja atau usaha, atau fasilitasi mendapatkan lahan usaha;\n3. lahan tempat tinggal dengan status hak milik; dan\n4. bimbingan, pengembangan, dan perlindungan hubungan kemitraan usaha.\nKebutuhan pengembangan usaha di luar bantuan tersebut diupayakan secara swadaya dan/atau melalui bantuan badan usaha.	Hak & Kewajiban	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 15 (UU 29/2009)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	TSM, swakarsa mandiri, transmigrasi mandiri, bantuan mandiri	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
33	Apa kewajiban transmigran dan apa sanksinya bila dilanggar?	Setiap transmigran wajib:\n1. bertempat tinggal menetap di permukiman transmigrasi;\n2. memelihara kelestarian lingkungan;\n3. memelihara dan mengembangkan kegiatan usahanya secara berdaya guna dan berhasil guna;\n4. mempertahankan dan memelihara pemilikan tanah dan aset produksinya;\n5. memelihara hubungan yang serasi dengan masyarakat setempat serta menghormati dan memperhatikan adat istiadatnya; dan\n6. mematuhi ketentuan ketransmigrasian.\nTransmigran yang tidak melaksanakan kewajiban ini dikenakan sanksi administratif berupa teguran lisan, teguran tertulis, atau pencabutan status sebagai transmigran (Pasal 35D UU 29/2009); tata cara penjatuhannya diatur dengan Peraturan Pemerintah (Pasal 35F).	Hak & Kewajiban	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	Pasal 16 & Pasal 35D	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	kewajiban transmigran, larangan, sanksi, pencabutan status, meninggalkan lokasi, menjual lahan	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
34	Apakah lahan untuk transmigran diberikan dengan status hak milik?	Pada prinsipnya ya. Pemerintah menyediakan tanah bagi penyelenggaraan transmigrasi sesuai rencana tata ruang wilayah. Tanah yang diperoleh Pemerintah untuk transmigrasi diberikan dengan hak pengelolaan, lalu tanah yang diperuntukkan bagi transmigran diberikan dengan status hak milik. Menurut penjelasan undang-undang, hak milik diberikan setelah transmigran memenuhi persyaratan tertentu yang ditetapkan Menteri. Bila tanah yang akan diberikan dikuasai badan usaha, tanah tersebut lebih dulu diserahkan kepada Pemerintah.\nPada Transmigrasi Swakarsa Berbantuan, lahan usaha di areal Hak Pengelolaan atas nama Menteri diberikan dengan status hak milik; di luar areal itu statusnya mengikuti status asal lahan.\nPada Transmigrasi Umum, lahan usaha dan lahan tempat tinggal beserta rumah diberikan dengan status hak milik. Pada Transmigrasi Swakarsa Berbantuan, lahan tempat tinggal beserta rumah berstatus hak milik, sedangkan lahan atau sarana usaha berstatus hak milik atau status lain sesuai pola usahanya. Pada Transmigrasi Swakarsa Mandiri, yang diberikan dengan status hak milik adalah lahan tempat tinggal; untuk lahan usaha, pemerintah memberikan fasilitasi.\nPersoalan sertifikat atau sengketa lahan perorangan perlu diperiksa petugas berdasarkan data Anda.	Pertanahan	UU 15/1997 jo. UU 29/2009 tentang Ketransmigrasian	UU 15/1997: Ps. 23–24, penj. Ps. 24 ayat (3); UU 29/2009: Ps. 13–15, penj. Ps. 14 ayat (1) huruf b	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	hak milik, sertifikat, SHM, status tanah, hak pengelolaan, HPL, lahan usaha, lahan pekarangan	https://jdih.transmigrasi.go.id/web/regulations/category/undang-undang	\N	\N	belum_diketahui	\N
35	Peraturan apa saja yang menjadi dasar penyelenggaraan transmigrasi?	- UU 15/1997 tentang Ketransmigrasian sebagaimana diubah dengan UU 29/2009.\n- PP 19/2024 tentang Peraturan Pelaksanaan UU Ketransmigrasian, sebagaimana diubah dengan PP 37/2025.\n- Perpres 172/2024 tentang Kementerian Transmigrasi.\n- Peraturan Menteri Transmigrasi, misalnya Permentrans 3/2026 tentang Transmigrasi Patriot.\nNaskah UU 15/1997, UU 29/2009, PP 19/2024, PP 37/2025, dan Permentrans 3/2026 dapat diunduh di JDIH Kementerian Transmigrasi (jdih.transmigrasi.go.id).	Regulasi	JDIH Kementerian Transmigrasi	Daftar Peraturan: kategori Peraturan Pemerintah & Undang-Undang; Permentrans 3/2026 (read/987)	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	dasar hukum, undang-undang transmigrasi, peraturan pemerintah, PP 19 2024, regulasi, JDIH	https://jdih.transmigrasi.go.id/web/regulations/category/peraturan-pemerintah	\N	\N	belum_diketahui	\N
36	Apa itu Program 5T Kementerian Transmigrasi?	Program 5T adalah lima program unggulan Kementerian Transmigrasi untuk mempercepat penyelesaian masalah, meningkatkan kesejahteraan transmigran, dan membangun kawasan ekonomi baru:\n1. Trans Tuntas: penyelesaian persoalan lahan di kawasan transmigrasi.\n2. Transmigrasi Lokal (Translok): penguatan ekonomi dan infrastruktur masyarakat setempat tanpa perlu berpindah jauh.\n3. Transmigrasi Patriot: kader pembangunan berkeahlian di kawasan transmigrasi.\n4. Trans Karya Nusantara: pengembangan ekonomi berbasis potensi kawasan untuk lapangan kerja berkelanjutan.\n5. Trans Gotong Royong: pembangunan kawasan berbasis kolaborasi pemerintah, masyarakat, dunia usaha, dan organisasi sosial.	Program	JDIH Kementerian Transmigrasi — Program Unggulan	Program 5T	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	program unggulan, 5T, lima program, transformasi transmigrasi	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
37	Apa itu program Trans Tuntas?	Trans Tuntas (T²), dengan slogan "Tuntas Lahan, Tuntas Harapan", adalah program penyelesaian menyeluruh atas persoalan lahan di kawasan transmigrasi, seperti sengketa, ketidakjelasan hak, dan konflik agraria. Kegiatannya meliputi pendataan, penyelesaian hukum, sertifikasi, serta revitalisasi dan optimalisasi lahan, agar transmigran memperoleh kepastian hak dan lahan dimanfaatkan secara produktif.	Program	JDIH Kementerian Transmigrasi — Program Unggulan	Program 1	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	Trans Tuntas, T2, sengketa lahan, konflik agraria, sertifikasi lahan, kepastian hak	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
38	Apa itu Transmigrasi Lokal (Translok)?	Transmigrasi Lokal (Translok), dengan slogan "Dari Lokal, Maju Global", berfokus pada penguatan ekonomi dan infrastruktur masyarakat setempat tanpa perlu berpindah jauh. Tujuannya membangun kota baru dari desa, mengurangi urbanisasi, dan meningkatkan kesejahteraan melalui pemanfaatan potensi lokal, dengan strategi pengembangan kawasan, revitalisasi infrastruktur, pemberdayaan ekonomi, kolaborasi multipihak, dan integrasi program nasional.	Program	JDIH Kementerian Transmigrasi — Program Unggulan	Program 2	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	translok, transmigrasi lokal, tanpa pindah jauh, kota baru dari desa	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
39	Apa itu Transmigrasi Patriot?	Transmigrasi Patriot, dengan slogan "Patriot Berkarya, Bangsa Berjaya", menyiapkan kader pembangunan di kawasan transmigrasi yang memiliki semangat pengabdian, keterampilan yang relevan, dan kemampuan membangun komunitas mandiri. Program ini bertujuan menghadirkan sumber daya manusia unggul yang mampu menyebarkan ilmu pengetahuan dan teknologi untuk mengatasi ketimpangan pembangunan, terutama di wilayah kaya sumber daya yang masih tertinggal. Penyelenggaraannya diatur dalam Peraturan Menteri Transmigrasi Nomor 3 Tahun 2026.	Program	JDIH Kementerian Transmigrasi — Program Unggulan; Permentrans 3/2026	Program 3 (beranda JDIH); Konsiderans huruf a–b Permentrans 3/2026	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	patriot, trans patriot, ekspedisi patriot, kader pembangunan, SDM unggul, Permentrans 3 2026	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
40	Apa itu program Trans Karya Nusantara?	Trans Karya Nusantara, dengan slogan "Kawasan Berkarya, Nusantara Berdaya", mengembangkan ekonomi berbasis potensi kawasan transmigrasi untuk menciptakan lapangan kerja berkelanjutan. Program ini mendorong industri unggulan lokal seperti pertanian, perikanan, pengolahan, dan pariwisata melalui kemitraan dengan dunia usaha, pelatihan SDM, dan pembangunan sentra ekonomi.	Program	JDIH Kementerian Transmigrasi — Program Unggulan	Program 4	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	Trans Karya Nusantara, lapangan kerja, industri lokal, sentra ekonomi, investasi	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
41	Apa itu program Trans Gotong Royong?	Trans Gotong Royong (Trans GR), dengan slogan "Bangun Bersama, Sejahtera Semua", adalah pembangunan kawasan transmigrasi berbasis kolaborasi pemerintah, masyarakat, dunia usaha, dan organisasi sosial. Tujuannya mempercepat pembangunan infrastruktur dasar, mendorong kemandirian ekonomi, dan memperkuat harmoni sosial melalui pendekatan multipihak, revitalisasi kawasan, ekonomi kolaboratif, dan pemberdayaan komunitas.	Program	JDIH Kementerian Transmigrasi — Program Unggulan	Program 5	ditinjau	2027-05-14	\N	\N	\N	0	0	0	2026-11-14 00:16:46	2026-11-14 00:16:46	Trans Gotong Royong, Trans GR, kolaborasi, CSR, infrastruktur dasar	https://jdih.transmigrasi.go.id/	\N	\N	belum_diketahui	\N
\.


--
-- Data for Name: knowledge_sources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_sources (id, kind, name, url, knowledge_document_id, follow_links, is_active, public_file, status, error, pages_count, passages_count, used_count, content_hash, fetched_at, changed_at, created_by, created_at, updated_at, dasar_hukum, tanggal_dasar, status_dasar, diganti_oleh) FROM stdin;
1	situs	SIBARDUKTRANS — Tata Cara Bertransmigrasi	https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
2	situs	SIBARDUKTRANS — Informasi Lokasi	https://sibarduktrans.transmigrasi.go.id/informasiLokasi	\N	t	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
3	situs	Kementrans — Persyaratan Transmigrasi	https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
4	situs	PPID — Tanya Jawab	https://ppid.transmigrasi.go.id/faq	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
5	situs	PPID — Standar Layanan	https://ppid.transmigrasi.go.id/standar-layanan/kanal-layanan	\N	t	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
6	situs	PPID — Tugas dan Fungsi	https://ppid.transmigrasi.go.id/kementerian/tugas-fungsi	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
7	situs	Kementrans — Cek Fakta	https://www.transmigrasi.go.id/publikasi/cek-fakta/	\N	t	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
8	situs	JDIH — UU 15/1997 tentang Ketransmigrasian	https://jdih.transmigrasi.go.id/public/documents/1624513736__nomor__tahun_1997.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
9	situs	JDIH — UU 29/2009 Perubahan UU Ketransmigrasian	https://jdih.transmigrasi.go.id/public/documents/1624513932__nomor__tahun_2009.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
10	situs	JDIH — Permentrans 3/2026 tentang Transmigrasi Patriot	https://jdih.transmigrasi.go.id/public/documents/2026peraturan-menteri-transmigrasi3.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
11	situs	PPID — Visi dan Misi	https://ppid.transmigrasi.go.id/kementerian/visi-misi	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
12	situs	Kementrans — Visi dan Misi	https://www.transmigrasi.go.id/profil/visi-misi/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
13	situs	JDIH — Permentrans 11/2025 tentang Renstra Kementrans 2025–2029	https://jdih.transmigrasi.go.id/public/documents//d909885b-d591-4d37-95b2-5021d6c8a9e1Peraturan_Menteri_Transmigrasi_Nomor_11_Tahun_2025_tentang_Renstra_Kementrans_tahun_2025_2029.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
14	situs	Kementrans — Laporan Kinerja Tahun 2025	https://www.transmigrasi.go.id/wp-content/uploads/2026/08/Laporan-Kinerja-Kementerian-Transmigrasi-Tahun-2025.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
15	situs	JDIH — Permentrans 8/2025 tentang Transformasi Transmigrasi	https://jdih.transmigrasi.go.id/public/documents//e88aaee4-aadd-4bd2-b302-7e327b412088Permentrans_No_8_th_2025_-_Transformasi_Transmigrasi.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
16	situs	JDIH — Permentrans 13/2025 Perubahan Permentrans 8/2025	https://jdih.transmigrasi.go.id/public/documents/2025peraturan-menteri-transmigrasi13.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
17	situs	Kementrans — Renstra Ditjen PPKTrans 2025–2029	https://www.transmigrasi.go.id/wp-content/uploads/2026/09/Rencana-Strategis-Ditjen-PPKTrans-2025-2029.pdf	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
18	situs	Kementrans — Program Unggulan 5T	https://www.transmigrasi.go.id/programunggulan/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
19	situs	Kementrans — Program dan Kebijakan	https://www.transmigrasi.go.id/program-dan-kebijakan/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
20	situs	Kementrans — Transmigrasi Kini Diukur dari Lapangan Kerja	https://www.transmigrasi.go.id/mentrans-transmigrasi-kini-diukur-dari-lapangan-kerja-bukan-lagi-jumlah-penduduk-yang-dipindahkan/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
21	situs	Kementrans — Transmigrasi Hari Ini: dari Miskin Menjadi Sejahtera	https://www.transmigrasi.go.id/transmigrasi-hari-ini-perpindahan-penduduk-dari-miskin-menjadi-sejahtera/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
22	situs	Kementrans — Menteri Dialog dengan Warga Setempat atas Usulan Pemda	https://www.transmigrasi.go.id/tak-perlu-gelisah-menteri-iftitah-akan-dialog-langsung-dengan-warga-setempat-jika-ada-usulan-transmigrasi-dari-pemda/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
23	situs	Kementrans — Pusat Pertumbuhan Ekonomi Tak Cukup dengan Infrastruktur	https://www.transmigrasi.go.id/di-peking-university-iftitah-bangun-pusat-pertumbuhan-ekonomi-tak-cukup-hanya-dengan-infrastruktur/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
24	situs	Kementrans — Berdayakan Masyarakat Setempat lewat Transmigran Lokal	https://www.transmigrasi.go.id/fokus-berdayakan-masyarakat-setempat-kementrans-tempatkan-hampir-1-300-transmigran-lokal-di-10-lokasi/	\N	f	t	t	antre	\N	0	0	0	\N	\N	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46	\N	\N	belum_diketahui	\N
\.


--
-- Data for Name: knowledge_passages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_passages (id, knowledge_source_id, url, title, heading, page, body, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	0001_01_01_000000_create_users_table	1
2	0001_01_01_000001_create_cache_table	1
3	0001_01_01_000002_create_jobs_table	1
4	2026_01_01_000001_create_master_tables	1
5	2026_01_01_000002_create_tickets_tables	1
6	2026_01_01_000003_create_chat_tables	1
7	2026_10_05_045754_create_personal_access_tokens_table	1
8	2026_10_05_060000_create_activity_logs_table	1
9	2026_10_12_000001_add_tracking_fields_to_tickets_table	1
10	2026_10_12_000002_encrypt_nik_columns	1
11	2026_10_12_000003_add_performance_indexes	1
12	2026_10_12_000004_add_lookup_token_to_tickets_table	1
13	2026_10_12_000005_add_guest_identity_to_chat_conversations	1
14	2026_10_16_000001_create_knowledge_tables	1
15	2026_10_16_000002_add_assistant_fields_to_chat_tables	1
16	2026_10_17_000001_add_keywords_and_source_url_to_knowledge_articles	1
17	2026_10_17_000002_create_portals_and_referrals_tables	1
18	2026_10_18_000001_add_citizen_reminded_at_to_referrals	1
19	2026_10_25_000001_mark_existing_warga_emails_verified	1
20	2026_10_25_000002_create_account_activations_table	1
21	2026_10_25_000003_update_account_help_articles	1
22	2026_10_26_000001_add_data_verified_at_to_chat_conversations	1
23	2026_10_26_000002_sync_official_portals_and_channels	1
24	2026_10_27_000001_create_knowledge_sources_tables	1
25	2026_10_30_000001_create_ai_calls_table	1
26	2026_10_30_000002_add_ai_pending_at_to_chat_conversations	1
27	2026_10_30_000003_add_legal_basis_to_knowledge	1
28	2026_10_30_000004_rename_sigap_to_contact_center	1
29	2026_10_31_000001_add_province_to_tickets_and_chats	1
30	2026_11_01_000001_create_ai_quality_runs_table	1
31	2026_11_11_000001_create_units_table	1
32	2026_11_11_000002_create_ticket_dispositions_table	1
33	2026_11_11_000003_drop_upt_unit_level	1
34	2026_11_11_000004_survey_questionnaire_v2	1
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (email, token, created_at) FROM stdin;
\.


--
-- Data for Name: personal_access_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, last_used_at, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: portals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portals (id, code, name, url, action_url, action_label, audience, purpose, description, keywords, steps, prepare, proof_label, track_completion, managed_by, contact, is_active, sort, is_reachable, last_status, last_checked_at, created_at, updated_at) FROM stdin;
1	trans-tuntas	Trans Tuntas	https://tuntas-trans.transmigrasi.go.id/	https://tuntas-trans.transmigrasi.go.id/dashboard/public/lapor/	Buat pengaduan di Trans Tuntas	publik	Pengaduan masalah lahan transmigrasi: sengketa, penyerobotan, konflik, batas, serta legalitas atau sertifikat lahan	Program penyelesaian lahan transmigrasi: layanan aduan cepat, mediasi konflik, validasi dan percepatan legalitas lahan, serta pendampingan masyarakat.	lahan, tanah, sengketa lahan, diserobot, penyerobotan, konflik agraria, sertifikat, SHM, legalitas, tumpang tindih, batas lahan, mediasi, kebun	Tekan tombol di bawah. Formulir Pengaduan Masyarakat Trans Tuntas terbuka di tab baru.\nIsi nama lengkap, nomor KTP (16 digit), dan nomor HP.\nPilih Kategori Pengaduan "Lahan", lalu provinsi dan kabupaten/kota.\nTulis alamat lokasi kejadian dan tandai titiknya di peta bila bisa.\nSalin ringkasan aduan dari halaman ini ke kolom Isi Pengaduan, lalu lengkapi.\nLampirkan bukti bila ada, lalu tekan Kirim Pengaduan.\nSimpan kode tracking yang muncul, lalu masukkan di halaman ini.	KTP (nomor 16 digit)\nNomor HP aktif\nLokasi lahan: provinsi, kabupaten/kota, dan alamat\nBukti pendukung bila ada (foto, surat, sertifikat): JPG, PNG, PDF, atau DOC, maks. 5 MB	Kode tracking	t	Kementerian Transmigrasi	tuntas@transmigrasi.go.id · 021-7994372 · Senin–Jumat 08.00–16.00 WIB	t	1	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
2	lapor	SP4N-LAPOR!	https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi	\N	Buka SP4N-LAPOR!	publik	Aduan pelayanan publik yang juga menyangkut instansi lain, misalnya pemerintah daerah atau ATR/BPN	Sistem Pengelolaan Pengaduan Pelayanan Publik Nasional; laporan dapat diteruskan lintas instansi.	instansi lain, pemerintah daerah, pemda, BPN, ATR, lintas instansi, lapor.go.id	Tekan tombol di bawah. Halaman Kementerian Transmigrasi di SP4N-LAPOR! terbuka di tab baru.\nMasuk atau daftar akun LAPOR!.\nTulis laporan: apa yang terjadi, di mana, kapan, dan pihak yang terlibat. Salin ringkasan dari halaman ini.\nKirim laporan, simpan nomor tracking yang diberikan, lalu masukkan di halaman ini.	Identitas untuk akun LAPOR!\nUraian kejadian dan lokasinya\nBukti pendukung bila ada	Nomor tracking LAPOR!	t	KemenPAN-RB & Ombudsman RI	\N	t	2	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
3	sibarduktrans	SIBARDUKTRANS	https://sibarduktrans.transmigrasi.go.id/	https://sibarduktrans.transmigrasi.go.id/pendaftaran	Daftar di SIBARDUKTRANS	publik	Pendaftaran calon transmigran secara daring, tata cara bertransmigrasi, data transmigran, dan informasi lokasi tujuan	Sistem Informasi Penataan Persebaran Penduduk di Kawasan Transmigrasi.	daftar transmigrasi, pendaftaran, calon transmigran, ikut transmigrasi, mendaftar, lokasi tujuan, animo, tata cara bertransmigrasi	Tekan tombol di bawah. Halaman Pendaftaran Akun SIBARDUKTRANS terbuka di tab baru.\nBuat akun dengan nomor telepon, email, dan kata sandi.\nMasuk, lalu lengkapi data calon transmigran sesuai panduan.\nPendaftaran juga dapat dilakukan di kantor desa/kelurahan atau perangkat daerah kabupaten/kota yang menangani transmigrasi sesuai KTP Anda.\nKesulitan membuat akun atau belum punya email? Tekan "Butuh bantuan" di halaman ini; petugas Contact Center mendampingi Anda lewat chat sampai nomor pendaftaran didapat.\nSetelah berhasil, masukkan nomor pendaftaran Anda di halaman ini.	KTP-el\nKartu Keluarga dan surat nikah (bila berkeluarga)\nNomor HP dan email aktif\nSertifikat keahlian (bila mendaftar belum berkeluarga)	Nomor pendaftaran	t	Kementerian Transmigrasi	sibarduktrans@transmigrasi.go.id · (021) 7971972	t	3	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
4	ppid	PPID Kementerian Transmigrasi	https://ppid.transmigrasi.go.id/	https://ppid.transmigrasi.go.id/permohonan	Ajukan permohonan informasi	publik	Permohonan informasi publik dan salinan dokumen resmi, pengajuan keberatan, serta daftar informasi publik	Layanan keterbukaan informasi publik Kementerian Transmigrasi.	permohonan informasi, minta data, minta dokumen, salinan dokumen, keterbukaan informasi, keberatan, PPID, laporan kinerja, anggaran	Tekan tombol di bawah. Formulir Permohonan Informasi PPID terbuka di tab baru.\nIsi identitas, rincian informasi yang diminta, tujuan penggunaan, serta cara memperoleh dan pengirimannya.\nSimpan nomor registrasi untuk melacak permohonan di menu Cek Status Pengajuan.	KTP\nRincian informasi yang diminta dan tujuan penggunaannya\nEmail aktif untuk menerima salinan digital	Nomor registrasi	f	PPID Kementerian Transmigrasi	ppid@transmigrasi.go.id · 021-7994372 · WhatsApp 0812-9001-9358 · Senin–Jumat 08.00–15.00 WIB	t	4	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
5	sipukat	SIPUKAT	https://sipukat.transmigrasi.go.id/	\N	Buka peta SIPUKAT	publik	Peta terpadu dan data kawasan transmigrasi: kawasan prioritas nasional, komoditas unggulan, HPL, dan potensi investasi	Sistem Informasi Peta Terpadu Kawasan Transmigrasi.	peta kawasan, data kawasan, lokasi kawasan transmigrasi, komoditas unggulan, investasi, HPL, kawasan prioritas, pronas, transpolitan	\N	\N	\N	f	Kementerian Transmigrasi	\N	t	5	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
6	jdih	JDIH Kementerian Transmigrasi	https://jdih.transmigrasi.go.id/	https://jdih.transmigrasi.go.id/web/regulations	Cari peraturan di JDIH	publik	Naskah resmi peraturan transmigrasi: undang-undang, peraturan pemerintah, peraturan menteri, dan keputusan	Jaringan Dokumentasi dan Informasi Hukum Kementerian Transmigrasi.	peraturan, regulasi, undang-undang, peraturan menteri, permentrans, dasar hukum, unduh peraturan, naskah akademik	\N	\N	\N	f	Biro Hukum Kementerian Transmigrasi	jdih@transmigrasi.go.id	t	6	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
7	persyaratan-transmigrasi	Persyaratan Transmigrasi	https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi/	https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi	Baca tata cara bertransmigrasi	publik	Syarat dan tata cara menjadi transmigran dari Kementerian Transmigrasi	Halaman resmi persyaratan dan panduan tata cara bertransmigrasi.	syarat, persyaratan, syarat transmigran, umur, usia, berkeluarga, surat nikah, surat keterangan dokter, sertifikat pelatihan, seleksi, tata cara	\N	\N	\N	f	Kementerian Transmigrasi	humas@transmigrasi.go.id · 021-7994372	t	7	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
8	pengaduan-wewenang	Pengaduan Penyalahgunaan Wewenang	https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang	https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang	Baca tata cara pengaduan	publik	Laporan dugaan penyalahgunaan wewenang, pungutan liar, atau pelanggaran oleh pegawai/pejabat Kementerian Transmigrasi; ditindaklanjuti Inspektorat Jenderal	Pengaduan diterima PPID (datang langsung, email, formulir, atau kotak pengaduan) lalu diteruskan ke Menteri dan Inspektur Jenderal.	pungli, pungutan liar, minta uang, suap, pejabat, pegawai nakal, penyalahgunaan wewenang, pelanggaran, korupsi, inspektorat, itjen, whistleblowing	Siapkan identitas Anda dan identitas pihak yang dilaporkan.\nTuliskan perbuatan yang diduga melanggar, waktu dan tempat kejadian, serta bagaimana pelanggaran terjadi.\nKirim ke email humas@transmigrasi.go.id atau ppid@transmigrasi.go.id, atau datang ke Information Centre Kementerian Transmigrasi (Senin–Jumat 08.00–15.00 WIB).\nBila juga menyangkut instansi lain, Anda dapat melapor lewat SP4N-LAPOR! dan memilih agar identitas dirahasiakan.	Identitas pelapor\nNama/jabatan pihak yang dilaporkan bila tahu\nBukti atau keterangan pendukung (foto, rekaman, dokumen)	\N	f	Kementerian Transmigrasi (PPID & Inspektorat Jenderal)	humas@transmigrasi.go.id · ppid@transmigrasi.go.id · itjen@transmigrasi.go.id · 021-7994372	t	8	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
9	cek-fakta	Cek Fakta Kementrans	https://www.transmigrasi.go.id/publikasi/cek-fakta/	\N	Buka Cek Fakta	publik	Klarifikasi resmi atas kabar bohong (hoaks) seputar program transmigrasi, misalnya pendaftaran berbayar atau janji lahan palsu	Rubrik klarifikasi hoaks di situs resmi Kementerian Transmigrasi.	hoaks, hoax, kabar bohong, berita palsu, penipuan, benar tidak, klarifikasi, viral, pendaftaran berbayar, calo	\N	\N	\N	f	Kementerian Transmigrasi	humas@transmigrasi.go.id	t	9	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
10	gratifikasi-kpk	Gratifikasi Online (KPK)	https://gol.kpk.go.id/	\N	Buka Gratifikasi Online	publik	Pelaporan gratifikasi (pemberian hadiah kepada pegawai/pejabat) langsung ke KPK	Kanal resmi KPK yang juga dirujuk Inspektorat Jenderal Kementerian Transmigrasi.	gratifikasi, hadiah, parsel, bingkisan, lebaran, pemberian, uang terima kasih, kontraktor, rekanan, KPK	\N	\N	\N	f	Komisi Pemberantasan Korupsi	\N	t	10	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
11	presensi-rapat	Presensi Rapat	https://presensi-rapat.transmigrasi.go.id/	\N	Buka daftar hadir	publik	Daftar hadir rapat dan kegiatan Kementerian Transmigrasi untuk peserta yang diundang	\N	absen rapat, daftar hadir, presensi, undangan rapat, kehadiran kegiatan	\N	\N	\N	f	Kementerian Transmigrasi	\N	t	11	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
12	tc-more	TC-More	https://awasi.transmigrasi.go.id/	\N	\N	internal	Pemantauan progres kegiatan dan anggaran program kontraktual oleh Inspektorat Jenderal (khusus pegawai)	Trans Continuous Monitoring & Reporting.	\N	\N	\N	\N	f	Inspektorat Jenderal	\N	t	12	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
13	transcloud	TransCloud	https://www.transmigrasi.go.id/cloud/index.php/login	\N	\N	internal	Penyimpanan dan berbagi berkas internal (khusus pegawai)	\N	\N	\N	\N	\N	f	Kementerian Transmigrasi	\N	t	13	t	\N	\N	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referrals (id, token, code, portal_id, conversation_id, user_id, citizen_name, contact, summary, status, external_ref, assigned_to, created_by, opened_at, confirmed_at, follow_up_due_at, reminded_at, closed_at, closed_by, close_reason, created_at, updated_at, citizen_reminded_at) FROM stdin;
\.


--
-- Data for Name: referral_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referral_events (id, referral_id, user_id, actor, type, note, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, ip_address, user_agent, payload, last_activity) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (id, key, value, created_at, updated_at) FROM stdin;
1	sla_response_minutes	60	2026-11-14 00:16:46	2026-11-14 00:16:46
2	ews_enabled	true	2026-11-14 00:16:46	2026-11-14 00:16:46
3	auto_disposition	false	2026-11-14 00:16:46	2026-11-14 00:16:46
4	notification	{"pic_email":"biro.umum@kemenatrans.go.id","pic_phone":"081200000000","whatsapp_enabled":false}	2026-11-14 00:16:46	2026-11-14 00:16:46
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.surveys (id, ticket_id, rating, comment, created_at, updated_at, version, answers, overall, resolved, reuse, good_feedback, improve_feedback, age_group, education, occupation, skm_index) FROM stdin;
\.


--
-- Data for Name: ticket_dispositions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_dispositions (id, ticket_id, unit_id, assigned_by, accepted_by, closed_by, status, note, due_at, accepted_at, closed_at, return_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ticket_histories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_histories (id, ticket_id, from_status, to_status, actor_id, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ticket_replies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_replies (id, ticket_id, author_id, body, is_public, created_at, updated_at) FROM stdin;
\.


--
-- Name: account_activations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_activations_id_seq', 1, false);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 1, false);


--
-- Name: ai_calls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_calls_id_seq', 1, false);


--
-- Name: ai_quality_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_quality_runs_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 4, true);


--
-- Name: channel_sync_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_sync_logs_id_seq', 1, false);


--
-- Name: channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channels_id_seq', 5, true);


--
-- Name: chat_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_conversations_id_seq', 1, false);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, false);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.failed_jobs_id_seq', 1, false);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);


--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_articles_id_seq', 41, true);


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_documents_id_seq', 1, false);


--
-- Name: knowledge_passages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_passages_id_seq', 1, false);


--
-- Name: knowledge_sources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_sources_id_seq', 24, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 34, true);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personal_access_tokens_id_seq', 1, false);


--
-- Name: portals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portals_id_seq', 13, true);


--
-- Name: referral_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.referral_events_id_seq', 1, false);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.referrals_id_seq', 1, false);


--
-- Name: regions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regions_id_seq', 3, true);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 4, true);


--
-- Name: surveys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.surveys_id_seq', 1, false);


--
-- Name: ticket_dispositions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_dispositions_id_seq', 1, false);


--
-- Name: ticket_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_histories_id_seq', 1, false);


--
-- Name: ticket_replies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ticket_replies_id_seq', 1, false);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, false);


--
-- Name: units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.units_id_seq', 27, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict ccuji

