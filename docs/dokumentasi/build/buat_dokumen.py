"""Menyusun SIGAP-Dokumentasi-Fitur.html (dicetak ke PDF oleh cetak_pdf.mjs)."""

from pathlib import Path

HERE = Path(__file__).parent
fig_no = 0
tab_no = 0


def fig(name, caption, legend=None, size="full"):
    """Gambar + keterangan. legend = daftar penjelasan sorotan bernomor (atau satu kalimat)."""
    global fig_no
    fig_no += 1
    leg = ""
    if legend:
        if isinstance(legend, str):
            leg = f'<p class="legend"><span class="box"></span>{legend}</p>'
        else:
            items = "".join(f'<li><span class="num">{i + 1}</span>{t}</li>' for i, t in enumerate(legend))
            leg = f'<ol class="legend-list">{items}</ol>'
    return f"""
<figure class="{size}">
  <img src="img/{name}.jpg" alt="{caption}">
  <figcaption><b>Gambar {fig_no}.</b> {caption}</figcaption>
  {leg}
</figure>"""


def table(head, rows, widths=None, caption=None):
    global tab_no
    cap = ""
    if caption:
        tab_no += 1
        cap = f'<caption><b>Tabel {tab_no}.</b> {caption}</caption>'
    cols = "".join(f'<col style="width:{w}">' for w in widths) if widths else ""
    th = "".join(f"<th>{h}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    keep = ' class="keep"' if len(rows) <= 9 else ''
    return f'<table{keep}>{cap}<colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def note(text, kind="info"):
    return f'<div class="note {kind}">{text}</div>'


def chapter(no, title, lead, body, anchor):
    return f"""
<section class="chapter" id="{anchor}">
  <p class="eyebrow">Bab {no}</p>
  <h1>{title}</h1>
  <p class="lead">{lead}</p>
  {body}
</section>"""


def feature(title, what, how, figure_html="", extra=""):
    how_html = "".join(f"<li>{h}</li>" for h in how)
    return f"""
<div class="feature">
  <h3>{title}</h3>
  <p>{what}</p>
  <ul>{how_html}</ul>
  {extra}
  {figure_html}
</div>"""


def step(time, title, who, body, figure_html=""):
    return f"""
<div class="step">
  <div class="step-head"><span class="time">{time}</span><span class="step-title">{title}</span><span class="who">{who}</span></div>
  <div class="step-body">{body}</div>
  {figure_html}
</div>"""


# ---------------------------------------------------------------------------
CSS = (HERE / "gaya.css").read_text()

cover = """
<section class="cover">
  <div class="cover-top">
    <div class="logo"><span>S</span></div>
    <div><p class="brand">SIGAP</p><p class="brand-sub">Contact Center Kementerian Transmigrasi</p></div>
  </div>
  <div class="cover-mid">
    <p class="kicker">Dokumentasi Fitur &amp; Use Case</p>
    <h1>Semua urusan transmigrasi,<br>cukup mulai dari chat.</h1>
    <p class="cover-lead">Penjelasan lengkap fitur SIGAP untuk warga, pegawai, dan petugas: alur kerja, tangkapan layar aplikasi, contoh kasus end-to-end, serta posisi SIGAP terhadap SP4N-LAPOR!.</p>
  </div>
  <div class="cover-meta">
    <div><span>Versi</span><b>Edisi 2 · Oktober 2026 · cabang feat/contact-center-ai</b></div>
    <div><span>Tanggal</span><b>25 Oktober 2026</b></div>
    <div><span>Cakupan</span><b>Halaman publik TARA, Chat TARA, Panel Admin v2, Matriks Rekapitulasi, Asisten AI, Sumber Resmi, Pertanyaan Kebijakan</b></div>
  </div>
</section>"""

toc_items = [
    ("ringkasan", "Ringkasan"),
    ("latar", "Latar belakang, masalah, dan solusi"),
    ("peran", "Peran pengguna dan hak akses"),
    ("peta", "Peta fitur"),
    ("warga", "Fitur untuk warga"),
    ("admin", "Panel admin (Admin v2)"),
    ("ai", "Asisten AI TARA, Basis Pengetahuan, dan Sumber Resmi"),
    ("kasus", "Use case end-to-end"),
    ("sp4n", "Posisi terhadap SP4N-LAPOR!"),
    ("keamanan", "Keamanan dan pelindungan data"),
    ("status", "Status dan tindak lanjut"),
    ("lampiran", "Lampiran: daftar rute dan glosarium"),
]
toc = '<section class="toc"><p class="eyebrow">Isi dokumen</p><h1>Daftar isi</h1><ol>' + "".join(
    f'<li><a href="#{a}"><span class="toc-no">{i + 1}</span><span class="toc-t">{t}</span></a></li>' for i, (a, t) in enumerate(toc_items)
) + "</ol>" + note(
    "<b>Cara membaca gambar.</b> Semua gambar diambil dari aplikasi yang berjalan dengan data demo. Bagian yang dibahas diberi <span class='red'>bingkai merah</span>; bila lebih dari satu, bingkai diberi nomor yang dijelaskan di bawah gambar. Percakapan pada contoh kasus dijawab oleh AI asli (Sumopod, model deepseek-v4-flash).",
    "info",
) + "</section>"

# --- Bab 1 ------------------------------------------------------------------
bab1 = chapter(1, "Ringkasan", "SIGAP adalah contact center Kementerian Transmigrasi: satu pintu berbasis chat tempat warga dan pegawai bertanya, mengadu, dan dibimbing ke layanan yang tepat sampai urusannya selesai.", f"""
<div class="kpis">
  <div><b>1</b><span>pintu masuk: Chat TARA, untuk tamu tanpa akun maupun warga terdaftar</span></div>
  <div><b>24</b><span>sumber resmi dikutip langsung (UU, Permentrans, Renstra, Laporan Kinerja, SIBARDUKTRANS, PPID), 24 jam</span></div>
  <div><b>3 jalur</b><span>dijawab langsung, dirujuk dan didampingi ke portal, atau menjadi tiket kawasan</span></div>
  <div><b>14</b><span>menu panel admin, termasuk Rujukan, Basis Pengetahuan, dan Sumber Resmi</span></div>
</div>
<h2>Apa yang dikerjakan SIGAP</h2>
{table(["Kebutuhan", "Yang dilakukan SIGAP"], [
    ["Warga bertanya (syarat, cara daftar, lokasi)", "TARA menjawab dari artikel terbit dan kutipan situs resmi, menyebut sumber, alamat, dan tanggal diambil."],
    ["Warga bertanya soal kebijakan", "TARA merangkum posisi resmi dari Renstra, Laporan Kinerja, UU, dan siaran pers per aspek, jujur soal data yang belum ada, lalu mengarahkan ke PPID."],
    ["Warga perlu layanan portal lain", "Kartu portal (SIBARDUKTRANS, Trans Tuntas, PPID, Cek Fakta), lalu rujukan yang didampingi petugas sampai warga mengirim kode bukti."],
    ["Warga mengadu", "Ringkasan otomatis untuk petugas, tiket ke admin kawasan dengan SLA dan peringatan dini (EWS), dan warga memantau lewat nomor tiket."],
    ["Warga gaptek / tanpa email", "Cukup chat dengan nama. Petugas bisa mendaftarkan akun dan memulihkan kata sandi dari chat."],
    ["Pegawai mengalami gangguan kantor", "Formulir pengaduan internal, ditangani Super Admin, tidak masuk statistik publik."],
    ["Pimpinan butuh data", "Matriks Rekapitulasi (alur penanganan, kategori × status, dampak × SLA, kanal, kawasan, EWS), Data Terbuka, rekap rujukan berhasil, survei kepuasan, dan log aktivitas."],
], ["34%", "66%"])}
{fig("u01-darto-bertanya", "Contoh jawaban TARA di Chat TARA layar penuh: jawaban, kartu portal SIBARDUKTRANS, dan daftar sumber resmi.", ["Daftar sumber: artikel resmi dan kutipan langsung dari situs, dengan alamat dan tanggal diambil.", "Jawaban TARA beserta kartu portal tujuan."])}
""", "ringkasan")

# --- Bab 2 ------------------------------------------------------------------
bab2 = chapter(2, "Latar belakang, masalah, dan solusi", "Warga tidak tahu harus ke mana, dan aduan yang masuk tidak punya pemilik, target waktu, atau catatan yang utuh. SIGAP menyatukan pintunya dan mengantar sampai selesai.", f"""
<h2>Latar belakang</h2>
<p>Sejak Kabinet Merah Putih (Oktober 2024), Kementerian Transmigrasi berdiri sendiri, sehingga layanan informasi dan pengaduannya perlu dibangun dengan identitas dan alur kerjanya sendiri. Penerima layanannya beragam: calon transmigran, warga transmigran di kawasan yang banyak berada di daerah terpencil dengan sinyal terbatas, serta pegawai di kantor pusat dan UPT.</p>
<p>Layanan resmi Kementrans tersebar di banyak situs, dan kebijakan pemerintah mewajibkan pengelolaan pengaduan terintegrasi (SP4N, Perpres 76/2013), layanan digital (SPBE, Perpres 95/2018), serta pelindungan data pribadi (UU 27/2022).</p>
{table(["Layanan resmi", "Fungsi untuk warga"], [
    ["SIBARDUKTRANS", "Pendaftaran calon transmigran, tata cara, informasi lokasi"],
    ["Trans Tuntas", "Lapor dan lacak penyelesaian masalah lahan dan sertifikat"],
    ["PPID", "Permohonan informasi publik, keberatan, pengaduan penyalahgunaan wewenang"],
    ["JDIH", "Peraturan dan produk hukum transmigrasi"],
    ["Cek Fakta", "Klarifikasi hoaks seputar transmigrasi"],
    ["SP4N-LAPOR!", "Kanal pengaduan pelayanan publik nasional"],
    ["KPK GOL", "Pelaporan gratifikasi"],
], ["30%", "70%"], "Layanan resmi yang dirujuk SIGAP")}
<h2>Masalah dan solusinya</h2>
{table(["#", "Masalah", "Solusi di SIGAP", "Hasil"], [
    ["1", "Layanan tersebar; warga salah kanal", "<b>Katalog portal resmi</b> dengan langkah-langkah dan cek kesehatan tiap jam", "Warga langsung ke tempat yang benar"],
    ["2", "Pertanyaan rutin dijawab manual, hanya jam kerja", "<b>TARA 24 jam</b> menjawab dari artikel terbit dan Sumber Resmi", "Pertanyaan rutin selesai tanpa antre"],
    ["3", "Kanal formal butuh email dan formulir panjang", "<b>Chat tanpa akun</b>; petugas mendaftarkan akun dan memulihkan sandi dari chat", "Warga gaptek tetap terlayani"],
    ["4", "Aduan dari WA, IG, surat, loket tercecer", "<b>Satu kotak masuk</b> + Input Manual", "Semua aduan tercatat"],
    ["5", "Tidak jelas siapa yang menangani", "<b>Tiket per kawasan</b> dengan SLA, EWS, dan matriks", "Setiap aduan punya penanggung jawab"],
    ["6", "Rujukan dilepas begitu saja", "<b>Rujukan didampingi</b>: kode bukti, pengingat, tombol bantuan", "Diketahui warga berhasil atau tidak"],
    ["7", "NIK dan foto KTP lewat WA pribadi", "<b>Kartu konfirmasi data</b>, NIK disamarkan, foto tanpa EXIF di penyimpanan privat", "Data warga di jalur resmi"],
    ["8", "Gangguan kantor dilaporkan informal", "<b>Helpdesk internal</b> pegawai", "Ada target perbaikan"],
    ["9", "Pimpinan tanpa data utuh", "<b>Dasbor, survei, log, rekap rujukan</b>", "Keputusan berbasis data"],
], ["5%", "27%", "40%", "28%"], "Sembilan masalah dan solusinya")}
""", "latar")

# --- Bab 3 ------------------------------------------------------------------
bab3 = chapter(3, "Peran pengguna dan hak akses", "Lima peran memakai SIGAP. Hak akses dibatasi sesuai tanggung jawab, dan tindakan admin tercatat di Log Aktivitas.", table(
    ["Peran", "Siapa", "Yang bisa dilakukan"],
    [
        ["Tamu", "Siapa saja, tanpa akun", "Chat TARA dengan nama, kirim foto, menerima rujukan, melanjutkan chat di perangkat lain dengan nomor REF + kontak, melacak tiket."],
        ["Warga terdaftar", "Akun mandiri atau dibuatkan petugas", "Semua fitur tamu + Portal Warga (riwayat tiket, lampiran), formulir pengaduan, survei kepuasan."],
        ["Pegawai internal", "Pegawai Kementrans", "Formulir pengaduan internal (gangguan sarana dan TIK) tanpa akun, lalu melacak tiketnya."],
        ["Admin Kawasan", "Petugas kawasan (mis. Rina, SP3 Bulungan)", "Pesan Masuk, tiket kawasannya, Input Manual, Rujukan, Basis Pengetahuan (artikel masuk antrean tinjau), Data Kawasan, Kanal, Portal, Pengaturan profil."],
        ["Super Admin", "Tim pusat / TIK", "Semua menu, termasuk Tiket Internal, Daftar Admin, Log Aktivitas, menerbitkan artikel, menghapus sumber dan dokumen."],
        ["Asisten TARA", "AI (Sumopod deepseek-v4-flash)", "Menjawab dari sumber resmi (termasuk pertanyaan umum dan kebijakan), merujuk ke portal, meringkas aduan untuk petugas. Tidak beropini, tidak menerbitkan tiket, dan tidak memutuskan hak warga."],
    ],
    ["17%", "25%", "58%"],
    "Peran dan hak akses",
), "peran")

# --- Bab 4 ------------------------------------------------------------------
bab4 = chapter(4, "Peta fitur", "Seluruh fitur SIGAP dalam satu tabel. Rute ditulis seperti di aplikasi.", table(
    ["Kelompok", "Fitur", "Rute", "Peran"],
    [
        ["Publik", "Beranda TARA (baru) & beranda lama", "<code>/beranda-baru</code>, <code>/</code>", "Semua"],
        ["Publik", "Chat TARA layar penuh & widget", "<code>/chat</code>", "Tamu, warga"],
        ["Publik", "Katalog & formulir pengaduan", "<code>/katalog</code>, <code>/pengaduan/baru</code>", "Warga"],
        ["Publik", "Pengaduan internal pegawai", "<code>/pengaduan/internal</code>", "Pegawai"],
        ["Publik", "Lacak tiket", "<code>/lacak</code>, <code>/lacak/{tiket}</code>", "Semua"],
        ["Publik", "Halaman pengantar rujukan", "<code>/rujukan/{token}</code>", "Warga dirujuk"],
        ["Publik", "Akun: daftar, masuk, verifikasi, lupa & atur ulang sandi, aktivasi dari chat", "<code>/daftar</code>, <code>/masuk</code>, <code>/aktivasi/{token}</code>", "Warga"],
        ["Publik", "Portal Warga", "<code>/portal-warga</code>", "Warga"],
        ["Publik", "Panduan, pedoman layanan, peta kawasan, halaman statis", "<code>/panduan</code>, <code>/pedoman-layanan</code>, <code>/peta</code>", "Semua"],
        ["Publik", "Data Terbuka", "<code>/tentang</code>", "Semua"],
        ["Admin", "Matriks Rekapitulasi (alur, matriks, dampak × SLA, EWS, cetak)", "<code>/admin/matriks</code>", "Admin"],
        ["Admin", "Manajemen Tiket & detail tiket", "<code>/admin/tiket</code>", "Admin"],
        ["Admin", "Tiket Internal", "<code>/admin/tiket-internal</code>", "Super Admin"],
        ["Admin", "Input Manual", "<code>/admin/input-manual</code>", "Admin"],
        ["Admin", "Pesan Masuk (contact center)", "<code>/admin/chat</code>", "Admin"],
        ["Admin", "Rujukan (pendampingan)", "<code>/admin/rujukan</code>", "Admin"],
        ["Admin", "Basis Pengetahuan, tinjau, dokumen resmi", "<code>/admin/pengetahuan</code>", "Admin"],
        ["Admin", "Sumber Resmi (baru)", "<code>/admin/pengetahuan/sumber</code>", "Admin"],
        ["Admin", "Katalog Portal", "<code>/admin/portal</code>", "Admin"],
        ["Admin", "Daftar Admin, Log Aktivitas", "<code>/admin/petugas</code>, <code>/admin/log-aktivitas</code>", "Super Admin"],
        ["Admin", "Data Kawasan, Manajemen Kanal, Pengaturan", "<code>/admin/kawasan</code>, <code>/admin/kanal</code>, <code>/admin/pengaturan</code>", "Admin"],
        ["Otomatis", "Cek portal tiap jam, pantau rujukan, EWS harian, sinkron Sumber Resmi tiap Senin", "<code>sigap:*</code> (penjadwal)", "Sistem"],
    ],
    ["13%", "41%", "31%", "15%"],
    "Peta fitur SIGAP",
), "peta")

# --- Bab 5 ------------------------------------------------------------------
bab5 = chapter(5, "Fitur untuk warga", "Warga cukup mulai dari chat. Halaman lain mendukung: melapor dengan formulir, melacak tiket, mengikuti rujukan, dan mengelola akun.", f"""
{feature("5.1 Maskot TARA dan beranda baru",
    "TARA adalah maskot sekaligus nama asisten AI SIGAP: petugas perempuan berseragam Kementrans dengan headset, tampil dalam delapan pose (menyapa, mendengarkan, menunjuk, menjelaskan, memegang tablet, jempol, terima kasih, menyambut). Pose dipilih sesuai konteks halaman, mis. <i>menunjuk</i> di Katalog dan <i>mendengarkan</i> di Chat.",
    ["Beranda baru (<code>/beranda-baru</code>) menonjolkan TARA dan satu ajakan utama: ketik pertanyaan atau mulai chat.",
     "Semua halaman publik memakai bingkai yang sama: header dengan menu <b>Beranda · Lacak Tiket · Katalog Pengaduan · Peta Kawasan · Data · Panduan</b>, pita krem berisi judul dan pose TARA, footer navy, dan tombol TARA melayang di pojok kanan bawah.",
     "Beranda lama (<code>/</code>) tetap ada dan menampilkan lencana <b>BARU · Coba Desain Baru</b>."],
    fig("t01-beranda-tara", "Beranda TARA (/beranda-baru).", ["Maskot TARA.", "Kolom tanya: pesan langsung dibawa ke Chat TARA."]) + fig("t09-beranda-tara-ponsel", "Beranda TARA pada ponsel 390 px.", size="phone") + fig("p01-beranda-lama", "Beranda lama dengan tombol menuju desain baru.", "Tombol Coba Desain Baru."))}
{feature("5.2 Chat TARA layar penuh",
    "Pintu utama SIGAP. Tamu cukup menulis nama, lalu bertanya. Riwayat tersimpan di server, sehingga tidak hilang saat halaman dimuat ulang.",
    ["<b>Tanpa akun:</b> nama disimpan, cookie terenkripsi 30 hari membuat riwayat tetap muncul di perangkat yang sama.",
     "<b>Jawaban bersumber:</b> setiap jawaban menyebut nomor [n] yang cocok dengan daftar sumber, termasuk kutipan asli dan tanggal diambil.",
     "<b>Kartu portal:</b> bila kebutuhan dilayani portal lain, muncul kartu dengan tombol menuju portal tersebut.",
     "<b>Diteruskan ke petugas:</b> aduan, urusan pribadi, atau permintaan warga diteruskan dengan ringkasan dan nomor referensi <code>REF-…</code>.",
     "<b>Panel tiket</b> di kanan menampilkan tahapan: diterima, diteruskan, tiket terbit, ditindaklanjuti, selesai.",
     "<b>Lampiran foto</b> (metadata lokasi dibuang), <b>kartu konfirmasi data</b> dari petugas, tombol <b>Transkrip</b> dan <b>Akhiri</b>.",
     "<b>Lanjut di perangkat lain:</b> masukkan nomor REF dan kontak yang pernah ditinggalkan."],
    fig("u02-darto-diteruskan", "Percakapan diteruskan ke petugas: nomor referensi dan tahapan di panel kanan.", "Pesan sistem berisi nomor referensi percakapan."))}
{feature("5.3 Katalog dan formulir pengaduan",
    "Untuk warga yang ingin melapor lewat formulir. Katalog menjelaskan kanal yang tepat untuk tiap jenis masalah.",
    ["Katalog mengarahkan: aduan layanan kawasan ke SIGAP, lahan ke Trans Tuntas, informasi publik ke PPID, penyalahgunaan wewenang ke Inspektorat.",
     "Formulir pengaduan: kategori, kawasan, tingkat dampak, uraian, lampiran; tiket terbit dengan nomor untuk dilacak.",
     "Formulir dilindungi reCAPTCHA dan batas laju."],
    fig("t03-katalog-tara", "Katalog Pengaduan bergaya TARA.", ["Kanal utama: Layanan SIGAP (formulir).", "Pengaduan Internal Pegawai."], size="tall") + fig("t08-formulir-tara", "Formulir pengaduan warga."))}
{feature("5.4 Pengaduan internal pegawai",
    "Helpdesk pegawai untuk gangguan sarana kantor: internet, listrik, perangkat, aplikasi, dan fasilitas. Tidak perlu akun.",
    ["Isian: NIP, nama, unit, kontak, kategori, urgensi, lokasi, uraian, foto.",
     "Tiket ditandai internal: hanya Super Admin yang melihat, tidak masuk statistik publik dan peta.",
     "Formulir memuat peringatan bahwa pelanggaran pegawai dilaporkan ke Inspektorat Jenderal."],
    fig("p06-formulir-internal", "Formulir pengaduan internal pegawai."))}
{feature("5.5 Lacak tiket",
    "Warga memasukkan nomor tiket untuk melihat status, riwayat, dan batas waktu penanganan.",
    ["Status: Menunggu, Diverifikasi, Diproses, Selesai, Ditolak, ditampilkan sebagai garis waktu beserta petugas dan batas waktunya.", "Setelah tiket selesai, warga diminta mengisi survei kepuasan.", "Nomor tiket juga dikenali TARA di chat (mis. ketik <code>TKT-15</code>)."],
    fig("t04-lacak-tara", "Lacak Tiket: hasil tiket ditemukan beserta garis waktunya."))}
{feature("5.6 Akun warga",
    "Warga bisa mendaftar sendiri, atau dibuatkan akun oleh petugas dari chat.",
    ["Daftar, masuk (NIK/email/username), verifikasi email, lupa dan atur ulang kata sandi.",
     "<b>Aktivasi dari chat:</b> petugas menekan Daftarkan akun; warga menerima tombol di chat untuk membuat kata sandi (<code>/aktivasi/{token}</code>). Token hanya disimpan dalam bentuk hash.",
     "<b>Pemulihan lewat chat:</b> petugas mengirim tautan kata sandi baru tanpa warga harus punya email.",
     "<b>Portal Warga:</b> riwayat tiket dan lampiran milik warga."],
    fig("p11-masuk", "Halaman Masuk.", size="half") + fig("p12-daftar", "Halaman Daftar Akun.", size="half"))}
{feature("5.7 Panduan, pedoman layanan, dan peta kawasan",
    "Informasi pendukung: panduan memakai SIGAP, pedoman layanan (kanal, SLA, hak dan kewajiban), serta peta kawasan transmigrasi dan sebaran aduan publik.",
    ["Peta hanya menampilkan tiket publik; tiket internal tidak pernah ditampilkan.", "Pemilih wilayah di hero peta langsung memusatkan peta ke kawasan yang dipilih."],
    fig("t05-peta-tara", "Peta Kawasan bergaya TARA.", size="tall") + fig("t06-panduan-tara", "Panduan Layanan."))}
{feature("5.8 Data Terbuka",
    "Halaman <code>/tentang</code> (menu <b>Data</b>) menampilkan statistik layanan langsung dari database, tanpa data pribadi pelapor.",
    ["<b>Matriks harian:</b> laporan masuk hari ini, sedang diproses, selesai ditangani, total laporan publik.",
     "<b>Status penanganan</b> (Menunggu · Diverifikasi · Diproses · Selesai · Ditolak) dan <b>matriks bulanan</b> beserta persentase SLA.",
     "<b>Top kategori keluhan</b>, <b>distribusi kanal</b>, daftar <b>kawasan transmigrasi</b> beserta jumlah KK, dan dasar hukum keterbukaan data.",
     "Angka dihitung dari tiket publik saja; tiket internal pegawai tidak dihitung. Bila belum ada tiket, halaman menampilkan nol, bukan angka contoh."],
    fig("t07-data-terbuka", "Halaman Data Terbuka.", size="tall"))}
""", "warga")

# --- Bab 6 ------------------------------------------------------------------
bab6 = chapter(6, "Panel admin (Admin v2)", "Tampilan panel admin mengikuti desain Admin v2: sidebar navy, topbar dengan remah roti, judul halaman yang tegas, kartu statistik, dan tabel yang lega. Semua fitur lama tetap ada.", f"""
{feature("6.1 Tata letak baru",
    "Sidebar memuat 14 menu dalam satu daftar, antrean Menunggu petugas, dan tombol ciutkan. Topbar berisi remah roti, notifikasi, dan menu akun.",
    ["Badge emas pada <b>Pesan Masuk</b> (belum dibaca) dan <b>Rujukan</b> (perlu tindakan).",
     "Menu khusus Super Admin (Tiket Internal, Daftar Admin, Log Aktivitas) disembunyikan dari Admin Kawasan.",
     "Pada ponsel, sidebar dibuka lewat tombol menu di topbar."],
    fig("a01-layout-admin", "Tata letak panel admin Admin v2.", ["Sidebar navy: menu, badge, dan antrean Menunggu petugas.", "Topbar: remah roti, notifikasi, menu akun.", "Kartu statistik (KPI) bergaya Admin v2."]))}
{feature("6.2 Matriks Rekapitulasi",
    "Halaman pertama panel admin (<code>/admin</code>). Merekap tiket mengikuti proses aslinya: dari pintu masuk, lewat setiap tahap penanganan, sampai tuntas, lengkap dengan target SLA Pedoman Layanan. Semua angka dihitung langsung dari database sesuai cakupan peran (Admin Kawasan hanya melihat kawasannya).",
    ["<b>Saringan periode</b> (bulan berjalan, bulan sebelumnya, atau semua waktu) dan <b>kawasan</b>; tombol <b>Print</b> menghasilkan laporan cetak tanpa sidebar.",
     "<b>Alur penanganan:</b> pintu masuk (Formulir web, Input manual petugas, Chat TARA → petugas) → Menunggu → Diverifikasi → Diproses → Selesai / Ditolak, dengan penanda EWS per tahap. Klik tahap untuk menyaring daftar tiket.",
     "<b>Ditangani tanpa tiket:</b> percakapan yang cukup dijawab TARA, rujukan ke portal (dan yang berhasil), serta pertanyaan kebijakan yang diarahkan ke PPID.",
     "<b>KPI:</b> tiket berjalan, peringatan EWS, SLA terpenuhi, rata-rata respons awal, rata-rata penyelesaian.",
     "<b>Matriks</b> baris × status dengan sumbu yang bisa diganti: Kategori, Kawasan, Kanal, atau Petugas. Warna sel makin pekat sesuai jumlah; klik angka untuk membuka Manajemen Tiket yang sudah tersaring.",
     "<b>Dampak × SLA</b> (Kritis 1×24 jam / 3 hari kerja, Tinggi 3×24 jam / 7 hari, Sedang & Rendah 5 hari / 14 hari), <b>kanal masuk</b>, <b>sebaran kawasan</b>, dan <b>survei kepuasan</b>.",
     "<b>Perlu tindakan:</b> tiket yang melewati tenggat, urut dari yang paling lama, lengkap dengan petugas (atau \"Belum ditugaskan\").",
     "<b>Daftar tiket</b> lama tetap ada di bawah: pencarian, saringan, urutan, paginasi, dan sorotan baris EWS.",
     "<b>Kondisi kosong:</b> bila belum ada tiket, struktur alur dan matriks tetap tampil dengan angka nol, disertai panel yang menjelaskan tiga pintu masuk tiket."],
    fig("a02-matriks", "Matriks Rekapitulasi: bagian atas.", ["Alur penanganan tiket dari pintu masuk sampai tuntas, termasuk yang ditangani tanpa tiket.", "Matriks kategori × tahap penanganan."]) + fig("a02b-matriks-penuh", "Matriks Rekapitulasi satu halaman penuh.", ["Dampak × SLA, kanal masuk, dan sebaran kawasan.", "Perlu tindakan: tiket lewat tenggat.", "Daftar tiket lama dengan saringan."], size="tall") + fig("a02e-matriks-kosong", "Kondisi kosong (periode tanpa tiket), seperti keadaan produksi saat ini.", "Panel penjelasan dan tiga pintu masuk tiket.", size="tall"))}
{feature("6.3 Manajemen Tiket dan detail tiket",
    "Daftar tiket aktif dari semua kanal. Detail tiket memuat data pelapor, riwayat, balasan, lampiran, dan ubah status dengan catatan.",
    ["Admin Kawasan hanya melihat tiket kawasannya.", "Setiap perubahan status tercatat di riwayat dan Log Aktivitas, dan warga diberi notifikasi."],
    fig("a03-tiket", "Manajemen Tiket Aktif.") + fig("u17-tiket-detail-status", "Detail tiket.", "Bagian pengelolaan status tiket."))}
{feature("6.4 Tiket Internal dan Input Manual",
    "Tiket Internal menampung laporan pegawai. Input Manual mencatat laporan dari Instagram, WhatsApp, surat, atau loket agar masuk ke alur yang sama.",
    ["Kartu statistik: laporan hari ini, bulan ini, kategori teratas, rata-rata penyelesaian.",
     "Input Manual: sumber laporan, data pelapor (NIK opsional untuk medsos, tautan unggahan), detail, kawasan, kategori, dampak, lampiran."],
    fig("a05-tiket-internal", "Tiket Internal Pegawai.") + fig("a06-input-manual", "Input Pengaduan Manual."))}
{feature("6.5 Pesan Masuk (contact center)",
    "Tempat petugas melayani percakapan yang diteruskan TARA maupun live chat. Petugas melihat ringkasan AI, sehingga tidak perlu membaca dari awal.",
    ["Tab <b>Menunggu · Dijawab AI · Selesai · Semua</b>, pencarian nama/isi/REF.",
     "<b>Ambil percakapan</b> agar warga tahu siapa petugasnya.",
     "<b>Daftarkan akun</b> dan <b>Lupa kata sandi</b> langsung dari chat.",
     "<b>Minta konfirmasi data</b>: kartu berisi data laporan (NIK disamarkan) untuk dikonfirmasi warga.",
     "<b>Terbitkan tiket</b> dengan saran isian dari AI, <b>Sudah terjawab</b>, <b>Rujuk ke portal</b>, <b>Rujuk ke Inspektorat</b>.",
     "Penanda kuning bila sumber resmi yang dikutip TARA saling berbeda."],
    fig("a07-pesan-masuk", "Pesan Masuk.", ["Tab antrean percakapan.", "Daftarkan akun warga dari chat.", "Minta konfirmasi data.", "Terbitkan tiket.", "Rujuk ke portal."]))}
{feature("6.6 Rujukan",
    "Pendampingan warga yang dirujuk ke portal lain sampai warga mengirim kode bukti (mis. nomor pendaftaran).",
    ["Tab <b>Perlu tindakan · Menunggu warga · Selesai</b>; penanggung jawab otomatis petugas yang merujuk atau yang bebannya paling sedikit.",
     "Warga diingatkan sekitar 20 jam setelah dirujuk; petugas diingatkan bila lewat 2 hari kerja.",
     "Aksi: catatan, kirim pesan, tandai berhasil, alihkan ke petugas lain, tutup."],
    fig("a08-rujukan", "Daftar Rujukan."))}
{feature("6.7 Katalog Portal",
    "Daftar portal resmi yang boleh dirujuk TARA dan petugas, lengkap dengan langkah, persiapan, dan status kesehatan.",
    ["Setiap portal dicek tiap jam. Bila tidak dapat diakses, warga tidak diarahkan ke halaman error dan percakapan diteruskan ke petugas.",
     "Portal internal (TC-More, TEP, TransCloud, Presensi Rapat) tidak pernah ditawarkan ke warga."],
    fig("a14-katalog-portal", "Katalog Portal."))}
{feature("6.8 Daftar Admin, Log Aktivitas, Data Kawasan, Kanal, Pengaturan",
    "Menu pengelolaan.",
    ["<b>Daftar Admin:</b> tambah petugas, peran, wilayah tugas, email notifikasi.",
     "<b>Log Aktivitas:</b> jejak audit (login, perubahan status, penerbitan artikel, dll.).",
     "<b>Data Kawasan:</b> kode, nama, provinsi, koordinat, jumlah KK, status infrastruktur.",
     "<b>Manajemen Kanal:</b> media sosial, kantor pengaduan, integrasi kanal nasional (SP4N-LAPOR! masih stub) beserta log sinkron.",
     "<b>Pengaturan:</b> profil dan kata sandi, SLA dan EWS, kategori laporan, notifikasi tiket internal."],
    fig("a15-daftar-admin", "Daftar Admin SIGAP.") + fig("a19-pengaturan", "Pengaturan & Preferensi.") + fig("a18-manajemen-kanal", "Manajemen Kanal Pengaduan.") + fig("a16-log-aktivitas", "Log Aktivitas.") + fig("a17-data-kawasan", "Direktori Kawasan Transmigrasi.") + fig("a20-notifikasi", "Notifikasi di topbar.", "Daftar notifikasi petugas."))}
""", "admin")

# --- Bab 7 ------------------------------------------------------------------
bab7 = chapter(7, "Asisten AI TARA, Basis Pengetahuan, dan Sumber Resmi", "TARA hanya menjawab dari sumber resmi. Ada dua jenis sumber: artikel yang ditinjau petugas, dan kutipan langsung dari situs serta berkas resmi.", f"""
<h2>Alur jawaban TARA</h2>
<ol class="flow">
  <li><b>Pesan masuk.</b> Data pribadi (NIK, nomor HP, surel, nomor panjang) disamarkan sebelum dikirim ke AI. Nomor tiket langsung dijawab dengan kartu status.</li>
  <li><b>Cari sumber.</b> Maksimal 3 artikel terbit dan 3 kutipan Sumber Resmi. Pertanyaan panjang (12 kata kunci atau lebih) dipecah per bagian, misalnya "demografi", "urbanisasi", "hak masyarakat lokal"; tiap bagian dicarikan kutipannya sendiri lalu digabung bergiliran sampai 6 kutipan. Kutipan yang sama persis dikirim sekali, dan tiap situs mendapat giliran.</li>
  <li><b>AI menjawab</b> hanya dari sumber, menyebut nomor [n], dan menggolongkan pesan: informasi, aduan, pribadi, tidak jelas, atau lainnya. Pertanyaan kebijakan diberi penanda khusus (lihat 7.4).</li>
  <li><b>Tindakan:</b> menjawab dengan sumber; menampilkan kartu portal; merujuk otomatis (aduan yang dilayani portal, mis. lahan ke Trans Tuntas); atau meneruskan ke petugas dengan ringkasan.</li>
  <li><b>Tanpa sumber, tanpa jawaban:</b> TARA menulis "belum menemukan informasi resmi" dan pertanyaannya masuk daftar <i>Belum bisa dijawab AI</i> sebagai bahan artikel.</li>
</ol>
{table(["", "Artikel (Basis Pengetahuan)", "Kutipan (Sumber Resmi)"], [
    ["Isi", "Tanya-jawab yang ditulis atau dirapikan petugas", "Potongan teks asli dari situs dan berkas resmi"],
    ["Asal", "Ditulis manual, atau usulan AI dari dokumen", "Diambil otomatis dari <code>*.transmigrasi.go.id</code> dan berkas unggahan"],
    ["Ditinjau?", "Ya: Draf → Ditinjau → Terbit (Super Admin)", "Tidak; dapat dinonaktifkan per sumber"],
    ["Prioritas", "Pertama", "Pengisi pertanyaan yang belum punya artikel"],
    ["Diperbarui", "Manual", "Otomatis tiap Senin 02.00, hanya bila isi berubah"],
], ["16%", "42%", "42%"], "Dua jenis sumber jawaban")}
{feature("7.1 Basis Pengetahuan",
    "Artikel tanya-jawab dengan sumber, kategori, kata kunci, dan tanggal tinjau.",
    ["Admin Kawasan menyimpan artikel ke antrean tinjau; Super Admin menerbitkan lewat <b>Tinjau berurutan</b>.",
     "<b>Uji pencarian</b> memperlihatkan artikel dan kutipan yang akan dikirim ke AI untuk sebuah pertanyaan.",
     "<b>Buat dari dokumen resmi:</b> unggah PDF/DOCX; isinya langsung dapat dikutip dan AI mengusulkan artikel per halaman."],
    fig("a09-basis-pengetahuan", "Basis Pengetahuan.", ["Menuju Sumber Resmi.", "Buat artikel dari dokumen resmi."]) + fig("a10-uji-pencarian", "Uji pencarian untuk pertanyaan 'berapa batas usia ikut transmigrasi?'.", "Artikel dan kutipan Sumber Resmi yang ikut terkirim ke AI.") + fig("a13-tinjau-artikel", "Tinjau artikel berurutan.") + fig("a12-dokumen-resmi", "Buat artikel dari dokumen resmi (PDF/DOCX)."))}
{feature("7.2 Sumber Resmi",
    "Situs dan berkas resmi yang dikutip langsung oleh TARA. Setiap kutipan menyebut alamat, halaman, dan tanggal diambil.",
    ["Hanya domain <code>transmigrasi.go.id</code>, <code>peraturan.bpk.go.id</code>, dan <code>peraturan.go.id</code> beserta subdomainnya; pengalihan ke domain lain ditolak.",
     "Opsi <b>Ikuti tautan</b> mengambil halaman lain di bagian yang sama dan PDF/DOCX yang ditautkan (maks. 25 halaman).",
     "Situs yang sedang mati tidak menghapus kutipan lama; kutipan terakhir yang berhasil tetap dipakai.",
     "Berkas unggahan bisa ditandai <i>boleh dibuka warga</i> atau tidak.",
     "Saat ini terdaftar <b>24 sumber</b> dengan sekitar 1.300 kutipan (Tabel di bawah)."],
    fig("a11-sumber-resmi", "Sumber Resmi.", ["Tambah situs resmi.", "Jumlah kutipan aktif dan aturan domain."]),
    table(["Kelompok", "Sumber resmi yang dikutip TARA"], [
        ["Layanan & pendaftaran", "SIBARDUKTRANS (tata cara bertransmigrasi, informasi lokasi), persyaratan transmigrasi (transmigrasi.go.id)"],
        ["Informasi publik", "PPID: tanya jawab, standar layanan, tugas & fungsi, visi & misi; visi & misi Kementrans; Cek Fakta"],
        ["Dasar hukum", "UU 15/1997 Ketransmigrasian, UU 29/2009 (perubahan), Permentrans 3/2026 Transmigrasi Patriot, Permentrans 8/2025 Transformasi Transmigrasi dan perubahannya (Permentrans 13/2025)"],
        ["Arah & kinerja kebijakan", "Permentrans 11/2025 tentang Renstra Kementrans 2025–2029, Laporan Kinerja Kementrans 2025, Renstra Ditjen PPKTrans 2025–2029, halaman Program Unggulan 5T, Program dan Kebijakan"],
        ["Siaran pers Menteri", "Transmigrasi diukur dari lapangan kerja; Transmigrasi hari ini: dari miskin menjadi sejahtera; Dialog dengan warga setempat atas usulan pemda; Pusat pertumbuhan ekonomi tak cukup dengan infrastruktur; Berdayakan masyarakat setempat lewat transmigran lokal"],
    ], ["24%", "76%"], "Sumber Resmi yang terdaftar (25 Oktober 2026)"))}
{feature("7.3 Bila sumber resmi berbeda",
    "Situs resmi bisa saling berbeda. Contoh nyata: SIBARDUKTRANS menulis batas usia <b>19–53 tahun</b>, sedangkan halaman persyaratan transmigrasi.go.id menulis <b>19–49 tahun</b>. TARA tidak memilih salah satu.",
    ["Setiap versi ditampilkan beserta asal sumbernya dan nomornya.",
     "Muncul penanda kuning <b>Sumber resmi menyebut ketentuan berbeda</b> di chat warga dan di layar petugas.",
     "Untuk pertanyaan pribadi (mis. 'umur saya 50, bisa?'), ketentuan umum tetap ditampilkan, lalu diteruskan ke petugas untuk kepastian.",
     "Rekomendasi: setelah angka yang berlaku dipastikan, terbitkan satu artikel resmi agar diutamakan."],
    fig("u13-sri-sumber-berbeda", "Jawaban TARA saat sumber berbeda (ponsel).", "Penanda sumber resmi berbeda.", size="phone"))}
{feature("7.4 Pertanyaan umum dan pertanyaan kebijakan",
    "Warga tidak hanya bertanya soal syarat atau cara daftar. Ada juga pertanyaan umum (\"apa itu transmigrasi?\") dan pertanyaan kebijakan yang kritis, misalnya meminta kementerian <i>membuktikan</i>, <i>mengevaluasi</i>, atau <i>membenarkan</i> program transmigrasi. TARA menjawab keduanya langsung di chat dari sumber resmi, tanpa menerbitkan artikel baru.",
    ["<b>Pertanyaan umum</b> dijawab ringkas dengan sitasi [n] ke UU, Permentrans, dan halaman program.",
     "<b>Pertanyaan kebijakan</b> dijawab dengan susunan tetap: (1) posisi resmi yang ADA di sumber, dikelompokkan per aspek yang ditanyakan, setiap kalimat bersitasi; (2) aspek yang tidak tercakup sumber disebut terang, mis. \"data perbandingan efisiensi belum tersedia di sumber resmi yang saya miliki\"; (3) arahan ke PPID atau Humas untuk pernyataan resmi atau data kinerja.",
     "TARA <b>tidak beropini</b>, tidak membela atau mengkritik kebijakan, dan tidak mengarang angka, target, atau hasil evaluasi.",
     "Di bawah jawaban muncul catatan biru <b>Pertanyaan kebijakan</b> dengan tautan ke PPID Kementerian Transmigrasi. Catatan yang sama tampil di Pesan Masuk petugas.",
     "Bila sumber sama sekali tidak membahasnya, TARA tetap menjelaskan bahwa ini pertanyaan kebijakan dan mengarahkan ke PPID, lalu pertanyaannya masuk daftar <i>Belum bisa dijawab AI</i>.",
     "Pertanyaan kebijakan tidak diteruskan ke petugas (kecuali warga memintanya), dan aduan tidak pernah diturunkan menjadi pertanyaan kebijakan."],
    fig("u22-kebijakan-ppid", "Jawaban pertanyaan kebijakan: catatan PPID dan enam sumber resmi.", ["Catatan Pertanyaan kebijakan dengan tautan PPID.", "Sumber resmi: Renstra 2025–2029, siaran pers Menteri, Program dan Kebijakan, Permentrans 13/2025."]))}
<div class="keep"><h2>Konfigurasi AI</h2>
{table(["Pengaturan", "Nilai"], [
    ["Penyedia", "Sumopod (endpoint kompatibel OpenAI) <code>https://ai.sumopod.com/v1</code>"],
    ["Model", "<code>deepseek-v4-flash</code> (model penalaran)"],
    ["Mode berpikir", "<code>AI_REASONING_EFFORT=none</code> → jawaban ±1–3 detik (tanpa ini bisa lebih dari 45 detik)"],
    ["Suhu", "0,2 (jawaban konsisten)"],
    ["Data yang dikirim", "Pertanyaan dan riwayat 6 pesan terakhir yang sudah disamarkan, daftar portal, dan sumber"],
], ["28%", "72%"], "Konfigurasi asisten AI")}</div>
""", "ai")

# --- Bab 8 ------------------------------------------------------------------
kasus_a = f"""
<h2>A. Pak Darto ingin ikut transmigrasi, didampingi petugas Rina</h2>
<p><b>Pak Darto</b> (42 tahun) petani di Wonogiri, ingin ikut transmigrasi bersama keluarganya, tapi gaptek dan <b>tidak punya email</b>. Anaknya membukakan SIGAP di HP. Petugas yang mendampingi adalah <b>Rina Kartika</b>, Admin Kawasan SP3 Bulungan. Seluruh langkah di bawah dijalankan sungguhan di aplikasi.</p>
{step("Hari 1 · 09.05", "Bertanya", "Pak Darto",
    "<p>Pak Darto menulis nama, lalu bertanya <i>\"Saya mau ikut transmigrasi, caranya gimana?\"</i>. TARA menjawab dari artikel UU 15/1997 jo. 29/2009 dan kutipan SIBARDUKTRANS (tata cara & seleksi), menyertakan sumber dan kartu <b>SIBARDUKTRANS</b>.</p>",
    fig("u01-darto-bertanya", "TARA menjawab dengan sumber resmi dan kartu portal.", ["Sumber resmi dengan kutipan dan tanggal diambil.", "Jawaban dan kartu SIBARDUKTRANS."]))}
{step("Hari 1 · 09.08", "Tersendat: tidak punya email", "Pak Darto → TARA",
    "<p>Pak Darto menulis <i>\"Saya tidak punya email, bagaimana?\"</i>. Karena butuh bantuan petugas, percakapan <b>diteruskan</b> dengan ringkasan otomatis dan nomor referensi <code>REF-…</code>. Di luar jam kerja, Pak Darto diminta meninggalkan nomor WhatsApp.</p>",
    fig("u02-darto-diteruskan", "Percakapan diteruskan ke petugas.", "Nomor referensi percakapan."))}
{step("Hari 1 · 09.15", "Rina melihat antrean", "Rina (petugas)",
    "<p>Percakapan Pak Darto muncul di tab <b>Menunggu</b> dan di daftar <b>Menunggu petugas</b> di sidebar, lengkap dengan ringkasan asisten, sehingga Rina tidak perlu membaca dari awal.</p>",
    fig("u04-rina-kotak-masuk", "Pesan Masuk milik Rina.", ["Percakapan Pak Darto di tab Menunggu.", "Ringkasan asisten.", "Antrean Menunggu petugas di sidebar."]))}
{step("Hari 1 · 09.20", "Rina membalas dan merujuk", "Rina",
    "<p>Rina mengambil percakapan, menyapa Pak Darto, lalu menekan <b>Rujuk ke portal → SIBARDUKTRANS</b>. Rujukan dibuat dengan kode <code>RJK-…</code>, Rina otomatis menjadi pendamping, dan batas tindak lanjut 2 hari kerja.</p>",
    fig("u05-rina-pilih-portal", "Rina memilih portal tujuan.", "Kartu SIBARDUKTRANS."))}
{step("Hari 1 · 09.21", "Kartu rujukan di chat warga", "Pak Darto",
    "<p>Di chat Pak Darto muncul kartu: <i>\"Petugas merujuk Anda ke SIBARDUKTRANS… Rina mendampingi Anda sampai berhasil.\"</i> beserta tombol <b>Buka pengantar &amp; langkahnya</b>.</p>",
    fig("u07-darto-kartu-rujukan", "Kartu rujukan di Chat TARA.", "Kartu rujukan beserta kode dan nama pendamping."))}
{step("Hari 1 · 09.25", "Halaman pengantar", "Pak Darto",
    "<p>Halaman pengantar berisi langkah demi langkah, dokumen yang disiapkan, ringkasan, dan tombol ke SIBARDUKTRANS. Saat tombol ditekan, status rujukan menjadi <b>dibuka</b>.</p>",
    fig("u08-halaman-pengantar", "Halaman pengantar rujukan (/rujukan/{token})."))}
{step("Hari 1 · 09.30", "Minta bantuan", "Pak Darto → Rina",
    "<p>Pak Darto membuka <b>Mengalami kendala?</b> dan menulis <i>\"Saya belum punya email…\"</i>. Status rujukan menjadi <b>butuh bantuan</b> dan percakapan kembali ke Rina. Rina memandu: membuat email bersama anaknya, atau mendaftar langsung di dinas kabupaten sesuai KTP. Bila perlu akun SIGAP, Rina menekan <b>Daftarkan akun</b>.</p>",
    fig("u09-minta-bantuan", "Formulir minta bantuan di halaman pengantar.", "Formulir kendala yang langsung sampai ke pendamping."))}
{step("Hari 2 · 06.00", "Pengingat otomatis", "Sistem",
    "<p>Sekitar 20 jam setelah dirujuk, chat Pak Darto menerima pesan: <i>\"Apakah pendaftaran Anda di SIBARDUKTRANS sudah terkirim? Balas pesan ini dengan nomor pendaftaran…\"</i>. Riwayatnya masih ada berkat cookie 30 hari.</p>")}
{step("Hari 2 · 10.15", "Berhasil", "Pak Darto",
    "<p>Pak Darto cukup membalas <i>\"nomornya SBT-2026-04417\"</i>. Pesan itu dikenali sebagai <b>kode bukti</b> (tidak dikirim ke AI), rujukan langsung <b>BERHASIL</b>, dan Rina mendapat notifikasi. Nomor HP, NIK, dan nomor tiket SIGAP tidak akan dianggap kode bukti.</p>",
    fig("u11-darto-kirim-kode", "Kode bukti tercatat otomatis.", "Konfirmasi nomor pendaftaran SIBARDUKTRANS."))}
{step("Hasil", "Tercatat untuk pimpinan", "Menu Rujukan",
    "<p>Di menu Rujukan tercatat: Pak Darto dirujuk ke SIBARDUKTRANS, <b>berhasil</b> dengan pendamping Rina, beserta riwayat lengkap (dibuat → dibuka → butuh bantuan → berhasil). Pimpinan melihat berapa warga yang <b>benar-benar berhasil mendaftar</b>, bukan hanya yang bertanya.</p>",
    fig("u12-rujukan-berhasil", "Rujukan berhasil di menu Rujukan.", ["Status selesai: warga berhasil, dengan nomor pendaftaran.", "Riwayat langkah rujukan."]))}
{table(["Kejadian", "Respons aplikasi"], [
    ["Situs SIBARDUKTRANS mati", "Dicek tiap jam; tombol berubah menjadi <i>Portal sedang tidak dapat diakses</i>, warga tidak diarahkan ke halaman error."],
    ["Lewat 2 hari kerja tanpa bukti", "Pendamping diingatkan pada jam kerja; rujukan ditandai <b>Perlu tindakan</b>."],
    ["Rina cuti", "Super Admin <b>mengalihkan</b> rujukan ke petugas lain beserta riwayatnya."],
    ["Pak Darto ganti HP", "Melanjutkan chat dengan nomor REF dan nomor WhatsApp yang pernah ditinggalkan."],
    ["Bertanya soal calo", "TARA mengarahkan ke Cek Fakta Kementrans."],
], ["32%", "68%"], "Bila ada yang macet")}
"""

kasus_b = f"""
<h2>B. Pak Hendra: internet lantai 3 mati saat rapat anggaran</h2>
<p><b>Pak Hendra</b>, pegawai Biro Umum. Pukul 08.40 internet lantai 3 gedung Kalibata mati, padahal pukul 10.00 ada rapat daring dengan Bappenas.</p>
{table(["Langkah", "Yang terjadi"], [
    ["1. Melapor (1 menit)", "Membuka <b>Pengaduan Internal Pegawai</b>: NIP, nama, unit, ekstensi; kategori Internet/Jaringan, urgensi Tinggi, lokasi Lt. 3 Ruang Rapat Utama; foto modem. Tanpa akun."],
    ["2. Sistem", "Tiket terbit dan ditandai <b>internal</b>; urgensi Tinggi menentukan SLA; tidak masuk statistik publik, peta, atau daftar admin kawasan."],
    ["3. Penanganan", "Super Admin (dukungan TIK) di menu <b>Tiket Internal</b>: Verifikasi → Diproses (teknisi menuju lokasi) → Selesai (switch lantai 3 diganti). Setiap perubahan tercatat."],
    ["4. Pemantauan", "Pak Hendra memasukkan nomor tiket di <b>Lacak Tiket</b>."],
    ["5. Evaluasi", "Akhir bulan terlihat kategori gangguan terbanyak dan unit terdampak, mis. 'switch lantai 3 bermasalah 5 kali sebulan, perlu diganti total'."],
], ["22%", "78%"], "Alur pengaduan internal")}
{fig("p06-formulir-internal", "Formulir yang diisi Pak Hendra.")}
{fig("a05-tiket-internal", "Tiket Internal di panel Super Admin.")}
{note("<b>Penegasan:</b> pengaduan internal bukan kanal untuk melaporkan pelanggaran pegawai. Pungli atau penyalahgunaan wewenang diarahkan ke PPID / Inspektorat Jenderal (itjen@transmigrasi.go.id).", "warn")}
"""

kasus_c = f"""
<h2>C. Bu Sri bertanya batas usia: sumber resmi berbeda</h2>
<p><b>Bu Sri Wahyuni</b> bertanya dari HP: <i>\"Berapa batas usia ikut transmigrasi?\"</i>. TARA menemukan dua ketentuan berbeda di situs resmi dan menampilkan keduanya, beserta saran untuk memastikan ke petugas atau dinas.</p>
<div class="two">{fig("u14-sri-jawaban", "Jawaban TARA menyebut kedua versi.", size="phone")}{fig("u13-sri-sumber-berbeda", "Penanda sumber berbeda dan daftar sumbernya.", "Penanda sumber resmi berbeda.", size="phone")}</div>
"""

kasus_d = f"""
<h2>D. Aduan jalan rusak lewat chat → tiket → selesai</h2>
<p><b>Siti Aminah</b> menulis di chat: <i>\"Jalan poros SP3 Bulungan rusak parah sejak Juli, akses anak ke sekolah terganggu.\"</i> TARA menggolongkannya sebagai <b>aduan</b>, meringkasnya, dan meneruskan ke petugas.</p>
{table(["Langkah", "Yang terjadi"], [
    ["1", "TARA meringkas aduan (masalah, lokasi, sejak kapan, dampak) dan meneruskan ke petugas."],
    ["2", "Petugas membuka Pesan Masuk, menekan <b>Terbitkan tiket</b>; judul, kawasan, kategori, dan dampak sudah disarankan AI."],
    ["3", "Nomor tiket otomatis dikirim ke chat warga; tiket masuk ke admin kawasan SP3 Bulungan dengan SLA."],
    ["4", "Bila melewati batas waktu, EWS menandai tiket di Matriks Rekapitulasi dan kartu <i>Perlu tindakan</i>."],
    ["5", "Warga memantau di Lacak Tiket; setelah Selesai, warga mengisi survei kepuasan."],
], ["10%", "90%"], "Alur aduan dari chat")}
{fig("u15-siti-terbitkan-tiket", "Petugas menerbitkan tiket dengan saran isian AI.", ["Ringkasan asisten.", "Formulir tiket yang sudah terisi saran AI."])}
{fig("t04-lacak-tara", "Warga memantau tiket di Lacak Tiket: status, garis waktu, petugas, dan batas waktu.")}
"""

kasus_e = f"""
<h2>E. Laporan dari Instagram dicatat lewat Input Manual</h2>
<p>Akun <i>@warga_sp1</i> mengunggah foto lampu jalan padam di jalur poros SP1 Merauke. Petugas mencatatnya di <b>Input Manual</b>: sumber Media Sosial, username dan tautan unggahan, kawasan, kategori, dampak, serta lampiran. Tiket ikut alur yang sama (SLA, EWS, matriks), sehingga laporan dari kanal mana pun tercatat di satu tempat.</p>
{fig("a06-input-manual", "Input Manual untuk laporan dari media sosial.")}
"""

kasus_f = f"""
<h2>F. Bu Wulan bertanya "apa itu transmigrasi?"</h2>
<p><b>Bu Wulan</b>, guru SMP, ingin menjelaskan program transmigrasi kepada muridnya. Ia membuka Chat TARA dan bertanya <i>"Apa itu transmigrasi dan apa tujuannya?"</i>. Tidak perlu ada artikel khusus: TARA merangkum langsung dari sumber resmi.</p>
{table(["Langkah", "Yang terjadi"], [
    ["1. Bertanya", "Bu Wulan menulis nama, lalu pertanyaannya. TARA menggolongkannya sebagai <b>informasi</b>."],
    ["2. Mencari sumber", "Sistem mengambil artikel dan kutipan yang paling cocok: program unggulan (Translok, Trans Gotong Royong), Permentrans 3/2026 Transmigrasi Patriot, dan Renstra Kementrans 2025–2029."],
    ["3. Menjawab", "TARA menjelaskan pengertian dan tujuan program, setiap kalimat dengan nomor sumber [1]–[6]."],
    ["4. Memeriksa", "Bu Wulan bisa membuka setiap sumber: nama dokumen, kutipan aslinya, halaman, dan tanggal diambil."],
], ["22%", "78%"], "Alur pertanyaan umum")}
{fig("u20-tanya-umum", "Jawaban TARA untuk pertanyaan umum beserta sumber resminya.", "Daftar sumber resmi: artikel program unggulan, Permentrans 3/2026, dan Renstra 2025–2029 (halaman 85).")}
"""

kasus_g = f"""
<h2>G. Pertanyaan kebijakan yang kritis</h2>
<p>Seorang mahasiswa pascasarjana menguji TARA dengan empat pertanyaan kebijakan, setara pertanyaan rapat dengar pendapat atau ujian tesis. Sebelum perbaikan 25 Oktober 2026, TARA hanya menemukan 1–2 kutipan, sehingga jawabannya dangkal atau \"belum menemukan informasi resmi\". Penyebabnya: sumber yang terdaftar belum memuat alasan kebijakan, dan pertanyaan sepanjang 20–29 kata kunci hampir tidak pernah cocok dengan satu kutipan.</p>
<p>Perbaikannya: 12 sumber kebijakan ditambahkan (Renstra, Laporan Kinerja, Permentrans 8 & 13/2025, siaran pers Menteri), pencarian pertanyaan panjang dipecah per aspek, dan aturan khusus pertanyaan kebijakan diberlakukan. Hasil uji ulang di <b>server produksi</b> (app2.andimohamad.my.id) dengan AI asli:</p>
{table(["Pertanyaan (diringkas)", "Sebelum", "Sesudah", "Sumber utama yang dikutip"], [
    ["1. Bagaimana membuktikan transmigrasi modern bukan sekadar pemindahan penduduk, melainkan strategi pembangunan yang adil dan berkelanjutan?", "1 kutipan", "6 sumber", "Renstra 2025–2029, Renstra PPKTrans, Permentrans 8/2025, Cek Fakta, siaran pers \"dari miskin menjadi sejahtera\""],
    ["2. Bagaimana mengevaluasi keberhasilan pendekatan berbasis kawasan (demografi, urbanisasi, ketimpangan, hak masyarakat lokal)?", "Tidak terjawab", "5 sumber", "Renstra 2025–2029, Program 5T, UU 29/2009, Renstra PPKTrans, Cek Fakta"],
    ["3. Bila pemerataan bisa lewat infrastruktur, investasi, dan digitalisasi tanpa memindahkan penduduk, apa dasar transmigrasi tetap relevan dan efisien?", "Tidak terjawab", "5 sumber", "Siaran pers \"diukur dari lapangan kerja\", Renstra 2025–2029, Laporan Kinerja 2025, Program dan Kebijakan, Permentrans 13/2025"],
    ["4. Bagaimana menyeimbangkan kepentingan nasional dengan hak individu memilih tempat tinggal dan pekerjaan?", "2 kutipan", "5 sumber", "UU 15/1997, UU 29/2009, Renstra, siaran pers \"pusat pertumbuhan tak cukup dengan infrastruktur\""],
], ["40%", "13%", "11%", "36%"], "Uji pertanyaan kebijakan di produksi, sebelum dan sesudah perbaikan")}
<p>Contoh inti jawaban pertanyaan 3: <i>"Paradigma keberhasilan transmigrasi kini tidak lagi diukur dari jumlah penduduk yang dipindahkan, melainkan dari lapangan kerja yang tercipta, investasi yang masuk, dan kesejahteraan masyarakat [5]."</i> Jawaban lalu menyebut bahwa kajian yang membandingkan efisiensi transmigrasi dengan alternatif tanpa pemindahan penduduk belum tersedia di sumber resmi, dan menutup dengan arahan ke PPID atau Humas.</p>
{fig("u21-kebijakan-jawaban", "Jawaban pertanyaan kebijakan nomor 3 di Chat TARA (AI asli), dikelompokkan per aspek dengan sitasi. Di akhir jawaban TARA menyebut aspek yang tidak tercakup sumber.")}
{note("<b>Batas yang disengaja:</b> TARA tidak akan menjawab sedalam pejabat, karena ia tidak boleh mengarang sikap resmi atau data evaluasi. Targetnya: menjawab sebatas yang tertulis di sumber resmi, jujur soal sisanya, dan mengarahkan ke jalur resmi (permohonan informasi publik ke PPID).", "info")}
"""

kasus_h = f"""
<h2>H. Koordinator memakai Matriks Rekapitulasi di rapat Senin</h2>
<p><b>Pak Bayu</b>, koordinator contact center, menyiapkan bahan rapat mingguan. Ia membuka panel admin; halaman pertama langsung Matriks Rekapitulasi periode Oktober 2026. Angka di bawah adalah data demo lokal; keadaan produksi dibahas di akhir.</p>
{table(["Langkah", "Yang dilihat dan dilakukan"], [
    ["1. Gambaran umum", "<b>14 tiket</b> bulan ini: 13 dari formulir web, 1 dari input manual. Menunggu 6, Diverifikasi 0, Diproses 6, Selesai 2, Ditolak 0. <b>10 tiket lewat tenggat</b>. Di luar tiket, 8 percakapan cukup dijawab TARA dan 14 warga dirujuk ke portal (5 berhasil)."],
    ["2. Mencari titik masalah", "Matriks kategori menunjukkan <b>Infrastruktur Dasar 11 tiket dengan 9 EWS</b>. Ganti sumbu ke Kawasan: hampir semuanya dari <b>SP1 Merauke</b>."],
    ["3. Menelusuri", "Klik sel <i>Infrastruktur Dasar × Diproses</i> (6). Manajemen Tiket terbuka dengan saringan periode dan kategori yang tampil sebagai chip; tiket bisa langsung dibuka dan ditindaklanjuti."],
    ["4. Menugaskan", "Kartu <b>Perlu tindakan</b> menunjukkan beberapa tiket sudah lewat 6–17 hari dan sebagian <b>belum ditugaskan</b>. Pak Bayu menugaskan petugas kawasan dari detail tiket."],
    ["5. Membaca kanal", "Sumbu Kanal memperlihatkan belum ada tiket dari Chat TARA. Artinya aduan di chat masih diselesaikan sebagai jawaban atau rujukan, belum diterbitkan sebagai tiket; dibahas apakah ada aduan yang perlu diterbitkan."],
    ["6. Rapat", "Tombol <b>Print</b> mencetak matriks tanpa sidebar untuk dibagikan."],
], ["22%", "78%"], "Matriks Rekapitulasi dalam rapat mingguan")}
{fig("a02c-matriks-sumbu-kanal", "Matriks dengan sumbu Kanal.", "Matriks kanal masuk × tahap penanganan.")}
{fig("a02d-drilldown-tiket", "Hasil klik sel matriks: Manajemen Tiket tersaring periode dan kategori.")}
{note("<b>Keadaan produksi (25 Oktober 2026):</b> belum ada tiket sama sekali, sehingga Matriks tampil dalam kondisi kosong. Ini bukan error. Pada periode yang sama tercatat 5 percakapan yang cukup dijawab TARA dan 1 rujukan ke portal; keduanya tampil di baris <i>Ditangani tanpa tiket</i>. Matriks terisi otomatis begitu tiket pertama masuk lewat formulir web, input manual, atau diterbitkan dari Pesan Masuk.", "info")}
"""

bab8 = chapter(8, "Use case end-to-end", "Contoh kasus nyata, dari warga yang ingin mendaftar, pegawai yang internetnya mati, sampai pertanyaan kebijakan yang kritis. Kasus A, C, D, F, dan G dijalankan sungguhan dengan AI asli.", kasus_a + kasus_b + kasus_c + kasus_d + kasus_e + kasus_f + kasus_g + kasus_h, "kasus")

# --- Bab 9 ------------------------------------------------------------------
bab9 = chapter(9, "Posisi terhadap SP4N-LAPOR!", "SIGAP melengkapi SP4N-LAPOR!, bukan menggantikannya. SP4N-LAPOR! adalah kanal nasional untuk mengirim pengaduan; SIGAP adalah pintu depan dan dapur Kementrans.", f"""
<div class="quote"><p class="q-label">Jawaban singkat (10 detik)</p><p>"SP4N-LAPOR! itu kanal nasional untuk mengirim pengaduan. SIGAP adalah contact center Kementrans: menjawab pertanyaan warga 24 jam, menyalurkan aduan ke petugas kawasan yang tepat, dan mendampingi sampai selesai. Aduan yang menyangkut instansi lain tetap kami arahkan ke SP4N-LAPOR!."</p></div>
<div class="quote"><p class="q-label">Jawaban lengkap (30 detik)</p><p>"Kebanyakan warga yang menghubungi kami sebenarnya bertanya, bukan mengadu: cara daftar transmigrasi, syarat, status sertifikat. SIGAP menjawabnya langsung dari sumber resmi, meneruskan yang perlu ditindaklanjuti ke petugas kawasan dengan target waktu, lalu mengarahkan ke layanan Kementrans yang tepat, seperti Trans Tuntas atau SIBARDUKTRANS, dan mendampingi warga sampai berhasil. Warga yang tidak punya email pun bisa dilayani lewat chat. Untuk aduan lintas instansi, kami justru mengarahkan warga ke SP4N-LAPOR!."</p></div>
{table(["", "SP4N-LAPOR!", "SIGAP"], [
    ["Kebutuhan", "Pengaduan, aspirasi, permintaan informasi", "Pertanyaan dan pengaduan, dijawab 24 jam dari sumber resmi"],
    ["Penerusan", "Ke instansi, lalu diteruskan lagi di dalamnya", "Langsung ke admin kawasan, dengan SLA dan EWS"],
    ["Layanan Kementrans", "Umum untuk semua instansi", "Rujukan yang didampingi ke SIBARDUKTRANS, Trans Tuntas, PPID, Cek Fakta"],
    ["Warga gaptek", "Harus membuat akun dan mengisi formulir", "Cukup chat; akun bisa dibuatkan petugas"],
    ["Banyak kanal", "Hanya laporan yang masuk lewat LAPOR!", "WA, IG, surat, loket lewat Input Manual + helpdesk internal"],
    ["Aduan internal pegawai", "Bukan tempatnya", "Helpdesk internal, hanya Super Admin"],
], ["18%", "36%", "46%"], "SP4N-LAPOR! dan SIGAP")}
{note("<b>Jangan diklaim dulu:</b> \"SIGAP sudah terhubung dengan SP4N-LAPOR!\". Integrasi dua arah baru berupa kerangka (stub) dan perlu akses API resmi dari KemenPAN-RB. Jawaban jujurnya: <i>\"Integrasinya sudah disiapkan, tinggal diaktifkan setelah kami mendapat akses API resmi.\"</i> Pasal Perpres 76/2013 sebaiknya dicek bagian hukum sebelum dikutip.", "warn")}
""", "sp4n")

# --- Bab 10 -----------------------------------------------------------------
bab10 = chapter(10, "Keamanan dan pelindungan data", "Data warga diperlakukan seminimal mungkin dan selalu lewat jalur resmi.", table(
    ["Aspek", "Penerapan"],
    [
        ["Data pribadi ke AI", "NIK, nomor HP, surel, dan nomor panjang disamarkan sebelum dikirim; AI tidak menerbitkan tiket atau memutuskan hak warga."],
        ["NIK", "Disimpan dengan hash (kunci terpisah <code>NIK_HASH_KEY</code>); kartu konfirmasi menampilkan NIK tersamar."],
        ["Foto & lampiran", "Diproses ulang untuk membuang metadata lokasi (EXIF), disimpan di penyimpanan privat, dihapus saat percakapan dipangkas."],
        ["Akun dari chat", "Token aktivasi/pemulihan hanya disimpan dalam bentuk hash dan punya masa berlaku."],
        ["Formulir publik", "reCAPTCHA v3 dan batas laju (lookup, akun, login, lampiran chat, lanjut chat 6×/jam)."],
        ["Sumber Resmi", "Hanya domain resmi, termasuk tujuan pengalihan; batas ukuran 20 MB dan batas waktu 30 detik."],
        ["Jejak audit", "Login, perubahan status, penerbitan artikel, sumber ditambah/dinonaktifkan tercatat di Log Aktivitas."],
        ["Tiket internal", "Hanya Super Admin; tidak masuk statistik publik, peta, maupun daftar admin kawasan."],
    ],
    ["24%", "76%"],
    "Keamanan dan privasi",
), "keamanan")

# --- Bab 11 -----------------------------------------------------------------
bab11 = chapter(11, "Status dan tindak lanjut", "Seluruh fitur di dokumen ini sudah berjalan di produksi <code>app2.andimohamad.my.id</code> (cabang <code>feat/contact-center-ai</code>) dengan 401 tes otomatis lolos. Beberapa hal masih perlu disiapkan sebelum dipakai warga secara luas.", f"""
{table(["Hal", "Status", "Langkah"], [
    ["AI TARA di produksi", "Aktif (Sumopod, deepseek-v4-flash)", "Ganti kunci API Sumopod yang sempat dibagikan di percakapan pengembangan"],
    ["Maskot TARA & halaman publik baru", "Aktif", "Putuskan apakah beranda TARA (<code>/beranda-baru</code>) dijadikan halaman utama <code>/</code>"],
    ["Sumber Resmi (24 sumber, ±1.300 kutipan)", "Aktif, sinkron tiap Senin", "Tambahkan dokumen resmi baru (mis. Laporan Kinerja 2026) bila terbit"],
    ["Pertanyaan kebijakan + arahan PPID", "Aktif (commit c346171)", "Pantau daftar <i>Belum bisa dijawab AI</i> untuk mencari dokumen yang masih kurang"],
    ["Matriks Rekapitulasi baru", "Aktif (commit b67e59b)", "Data produksi masih 0 tiket; matriks terisi otomatis saat tiket pertama tercatat"],
    ["32 artikel resmi hasil AI", "Status <i>Ditinjau</i>, sengaja tidak diterbitkan", "TARA menjawab langsung dari kutipan resmi; artikel diterbitkan hanya bila perlu jawaban baku"],
    ["Email notifikasi", "SMTP belum diatur", "Isi <code>MAIL_HOST</code> dan kredensial di server"],
    ["Integrasi SP4N-LAPOR!", "Kerangka (stub)", "Ajukan akses API resmi ke KemenPAN-RB"],
    ["Unit kerja formulir internal", "Masih nama lama", "Sesuaikan dengan Setjen, Itjen, Ditjen PPK Transmigrasi, Ditjen PEM Transmigrasi, BBPPMT/BPPMT"],
    ["Pengingat rujukan", "Lewat chat", "Peningkatan berikutnya: WhatsApp/SMS"],
], ["30%", "26%", "44%"], "Status dan langkah berikutnya")}
<h2>Riwayat rilis ke produksi (25 Oktober 2026)</h2>
{table(["Commit", "Isi rilis"], [
    ["6b9c8b5", "Sumber Resmi, portal resmi, AI diaktifkan di server"],
    ["801bd20", "Maskot TARA menggantikan TRANSI"],
    ["4558f50", "Halaman publik (Lacak, Katalog, Peta, Panduan) bergaya TARA"],
    ["4898a2d", "Perbaikan AI (salam, kata kunci pendek, aduan tanpa detail) + PDF UU dari JDIH sebagai Sumber Resmi"],
    ["54ed5ec", "Halaman Data Terbuka dan menu Data"],
    ["c346171", "Pertanyaan kebijakan, pencarian pertanyaan panjang, 12 sumber kebijakan baru"],
    ["b67e59b", "Matriks Rekapitulasi sesuai proses asli"],
], ["18%", "82%"], "Rilis ke produksi")}
{note("<b>Cadangan:</b> sebelum setiap rilis, image server diberi tag cadangan (mis. <code>pre-kebijakan</code>), sehingga versi sebelumnya bisa dipulihkan dalam hitungan menit.", "info")}
{note("<b>Temuan data:</b> batas usia calon transmigran berbeda antara SIBARDUKTRANS (19–53 tahun) dan halaman persyaratan transmigrasi.go.id (19–49 tahun). Sebaiknya dipastikan ke unit terkait, lalu diterbitkan satu artikel resmi.", "warn")}
""", "status")

# --- Bab 12 -----------------------------------------------------------------
bab12 = chapter(12, "Lampiran: daftar rute dan glosarium", "Rujukan cepat untuk tim teknis dan pembaca dokumen.", f"""
<h2>Perintah terjadwal</h2>
{table(["Perintah", "Jadwal", "Fungsi"], [
    ["<code>sigap:cek-portal</code>", "Tiap jam", "Cek ketersediaan portal tujuan rujukan"],
    ["<code>sigap:pantau-rujukan</code>", "Jam kerja, tiap jam", "Pengingat warga (~20 jam) dan pendamping (2 hari kerja)"],
    ["<code>sigap:ews-check</code>", "Harian 07.00", "Peringatan dini tiket mendekati/lewat batas"],
    ["<code>sigap:sync-channels</code>", "Harian 06.00", "Sinkron kanal nasional (stub)"],
    ["<code>sigap:sinkron-sumber</code>", "Senin 02.00", "Ambil ulang situs Sumber Resmi"],
    ["<code>sigap:uji-asisten</code>", "Manual", "Uji kualitas jawaban AI terhadap kumpulan pertanyaan"],
], ["30%", "22%", "48%"])}
<h2>Glosarium</h2>
{table(["Istilah", "Arti"], [
    ["TARA", "Maskot sekaligus nama asisten AI SIGAP (sebelumnya TRANSI)"],
    ["Pertanyaan kebijakan", "Pertanyaan yang meminta pembuktian, evaluasi, atau pembenaran kebijakan; dijawab dari sumber resmi lalu diarahkan ke PPID"],
    ["PPID", "Pejabat Pengelola Informasi dan Dokumentasi; jalur resmi permohonan informasi publik"],
    ["Renstra", "Rencana Strategis Kementrans 2025–2029 (Permentrans 11/2025)"],
    ["REF-…", "Nomor referensi percakapan chat"],
    ["TKT-…", "Nomor tiket pengaduan"],
    ["RJK-…", "Kode rujukan ke portal lain"],
    ["SLA", "Batas waktu penanganan sesuai tingkat dampak/urgensi"],
    ["EWS", "Early Warning System: penanda tiket mendekati atau melewati batas waktu"],
    ["Kode bukti", "Nomor dari portal tujuan (mis. nomor pendaftaran) yang menandai rujukan berhasil"],
    ["Kutipan", "Potongan teks asli dari Sumber Resmi yang dirujuk TARA"],
    ["Admin Kawasan", "Petugas yang menangani tiket kawasan tertentu"],
], ["24%", "76%"])}
""", "lampiran")

html = f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><title>SIGAP — Dokumentasi Fitur</title>
<link rel="preconnect" href="https://fonts.bunny.net"><link rel="stylesheet" href="https://fonts.bunny.net/css?family=inter:400,500,600,700|space-grotesk:500,600,700|jetbrains-mono:400,500">
<style>{CSS}</style></head><body>
{cover}{toc}{bab1}{bab2}{bab3}{bab4}{bab5}{bab6}{bab7}{bab8}{bab9}{bab10}{bab11}{bab12}
</body></html>"""
(HERE / "SIGAP-Dokumentasi-Fitur.html").write_text(html)
print("gambar:", fig_no, "tabel:", tab_no)
