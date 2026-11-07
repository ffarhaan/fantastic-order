# 🔒 DOKUMEN ATURAN BAKU & ARSITEKTUR TERKUNCI (LOCKED RULES)
## Faktur Tracker v2.0 — Final Stable & Realtime Architecture

Dokumen ini adalah acuan baku dan permanen untuk seluruh pengembangan, pemeliharaan, dan sesi interaksi pada proyek **Faktur Tracker**. Seluruh aturan di bawah ini telah diverifikasi, disetujui, dan **DI-LOCK TOTAL (TIDAK BOLEH DIUBAH TANPA PERSETUJUAN EKSPLISIT)**.

---

### 1. ATURAN BISNIS & LOGIKA INTI

#### A. Isolasi Mutlak DOO vs ORA (Strict Key Isolation)
1. **Identifikasi Jenis Transaksi**:
   - `isOraCustomer(customerName)`: Mengembalikan `true` JIKA nama pelanggan mengandung `HELIOS`, diawali `HAK`, diawali `IHC`, bernilai kode `1001`, atau kode pelanggan `CA-900001` (seluruh entitas di bawah konsorsium Helios/ORA). Pelanggan lain (Apotek Halomedika, Medika Prima, SBS, Pasti Hemat, K24, Kimia Farma, dll.) adalah **DOO** (`false`).
2. **Kunci Faktur (Invoice Key)**:
   - Faktur ORA: Wajib menggunakan suffix `${cleanInv}-1P` (contoh: `14040-1P`).
   - Faktur DOO: Wajib menggunakan nomor invoice murni `${cleanInv}` (contoh: `14040`).
   - Faktur dengan nomor sama di DOO dan ORA adalah dua entitas data terpisah dengan status cetak mandiri.
3. **Pemisahan Sales Order (No SO)**:
   - **DOO SO**: Berasal langsung dari kolom `Reference` file export DOO (`export.xls`). Nilai ini di-LOCK dan TIDAK BOLEH ditimpa oleh file ORA ataupun XXCUST.
   - **ORA SO**: Di export HTML bernilai internal (`-`). Nilai No SO resminya diisi saat file `XXCUST` diupload dengan mencocokkan `No Invoice AR` ke `${cleanInv}-1P`.
4. **Independensi Status Cetak & Strict Key Isolation (PERMANEN / LOCKED)**:
   - Menandai cetak pada DOO `14040` (key: `14040`) HANYA mengubah dan membaca key `14040`.
   - Menandai cetak pada ORA `14040` (key: `14040-1P`) HANYA mengubah dan membaca key `14040-1P`.
   - DILARANG KERAS melakukan fallback atau cross-matching status cetak antar key DOO dan ORA (misal `cleanKey` vs `cleanKey-1P`). Keduanya 100% independen untuk seluruh invoice sekarang dan seterusnya.
5. **Deteksi Faktur ORA Baru dari File XXCUST**:
   - Jika file `XXCUST` diunggah dan memuat faktur ORA baru yang belum ada di `export.xls`, faktur tersebut langsung didaftarkan dengan key `${cleanInv}-1P`, No SO terisi, status `Belum Terprint`, dan tidak akan bertabrakan dengan DOO.
   - Jika faktur ORA sudah ada dari `export.xls`, file `XXCUST` melengkapi No SO dan rincian item tanpa mengubah status cetak yang sudah ada.
6. **Pembacaan Lengkap & Pemetaan Otomatis File XXCUST (LOCKED)**:
   - File `XXCUST` dibaca lengkap dari kolom `No Invoice AR`, `Order Number`, `Nama Pelanggan`, `Kode Pelanggan`, serta rincian item produk/lot.
   - Seluruh entitas konsorsium Helios/ORA (termasuk awalan `HAK`, awalan `IHC`, `HELIOS`, kode `1001`, dan akun `CA-900001`) secara mutlak dipetakan ke key ORA `${cleanInv}-1P`.
   - Nama pelanggan umum (`PT Helios Alchemist Kesehatan` atau variasinya) secara otomatis dan case-insensitive disempurnakan menjadi nama cabang/apotek spesifiknya (contoh: `HAK Tirta Raya`, `HAK Kemuning`, `HAK Bungur Mlg`, `IHC SRI Suryaraya`), No SO terisi dari kolom `Order Number`, dan status cetak 100% terkunci permanen.
7. **Prinsip Non-Destructive Overwrite (Perlindungan Data Lengkap / Anti-Downgrade - LOCKED)**:
   - Mengunggah file baru (misal file export berkala) setelah file XXCUST **DILARANG MERUSAK DATA YANG LEBIH LENGKAP**:
     - No SO yang sudah terisi (misal `696000`) TIDAK BOLEH ditimpa oleh tanda strip (`-`) dari file export.
     - Nama cabang apotek yang sudah terisi spesifik (misal `HAK Tirta Raya`) TIDAK BOLEH ditimpa kembali oleh nama induk generic (`PT Helios Alchemist Kesehatan`).
     - List barang (`items`) yang sudah terisi dari XXCUST TIDAK BOLEH dihapus atau dikosongkan oleh file export yang tidak memiliki rincian barang.
8. **Jaminan Nol Tabrakan No SO & Isolasi Multi-SO Berbasis Tanggal Order (Zero SO Collision & Multi-Month Isolation - LOCKED TOTAL)**:
   - **Latar Belakang & Masalah**: Di sistem Oracle atau lintas siklus waktu/bulan, nomor invoice (faktur) dapat dipakai ulang atau di-reset untuk Sales Order (SO) yang sama sekali berbeda di bulan berikutnya (contoh riil: Invoice `27189` terbit pada Oktober untuk SO `ELZDZ2-6968` / `Apotek Sawarna Farma`, dan terbit kembali pada November untuk SO `1710443` / `Apotek Halomedika Cempaka Putih`).
   - **Evaluasi Dua Dimensi: Tanggal Order (Bulan) & No SO**:
     - Sistem wajib mengevaluasi **Tanggal Order (`order_date`)** selain No SO (`no_sales_order`).
     - Jika sebuah transaksi baru memiliki nomor faktur yang sama TETAPI Tanggal Order berbeda bulan (misal `10/2026` vs `11/2026`) dengan No SO yang berbeda, transaksi baru tersebut WAJIB 100% dialokasikan kunci unik mandiri (`${cleanInv}__${cleanSO}`, contoh: `27189__1710443`).
     - Sebaliknya, pada bulan yang sama (`same month`), satu nomor faktur yang memiliki selisih hari antara *Order Date* dan *Transaction Date* atau memiliki beberapa baris item/SO dalam satu faktur yang sama DILARANG KERAS dipecah menjadi baris duplikat `__`.
   - **Larangan Mutlak Penimpaan & Jaminan Anti-Tercemar (Zero Contamination)**:
     - DILARANG KERAS menimpa data lama atau mencampur transaksi berbeda hanya karena nomor invoicenya sama.
     - No SO DOO unik (misal `ELZDZ2-6968` milik Apotek Sawarna Farma) TIDAK BOLEH ditimpa oleh No SO ORA/November (misal `1710443` milik Cempaka Putih), dan sebaliknya.
     - Nama apotek pada transaksi baru wajib diambil murni dari data file bulan berjalan (Oracle XXCUST), dilarang menyalin nama apotek lama siklus sebelumnya.
     - Peta memori `existingStatusMap` wajib membedakan kunci komposit (`__`) agar data komposit tidak pernah menimpa slot nomor faktur induk.
   - **Tampilan UI & Pencarian Global**:
     - Di tabel UI, kolom "NO INVOICE" tetap menampilkan nomor invoice murni (`27189`).
     - Kolom "NO SO" menampilkan No SO riil masing-masing baris (`ELZDZ2-6968` untuk baris Oktober, `1710443` untuk baris November).
     - Kolom "PELANGGAN" menampilkan nama apotek riil masing-masing baris (`Apotek Sawarna Farma` untuk Oktober, `Apotek Halomedika Cempaka Putih` untuk November).
     - Pencarian global: Mengetik `ELZDZ2-6968` memunculkan transaksi Oktober saja, mengetik `1710443` memunculkan transaksi November saja, dan mengetik `27189` memunculkan KEDUA baris secara mandiri.
   - **Independensi Status Cetak**: Menandai Done Print pada satu transaksi tidak akan pernah mempengaruhi status cetak transaksi lainnya. Partisi Firestore bucket (`getPrintPartitionId`) memisahkan suffix `__` sehingga kedua transaksi tersimpan aman di bucket yang tepat tanpa overflow.
   - **Double-Layer Titanium Shield (Database Backend & Client-Side Parser - PERMANEN)**:
     - **TiDB Backend (`app/api/tidb/route.ts`)**: Klausul `ON DUPLICATE KEY UPDATE` pada tabel `fakturs_archive` dilengkapi pelindung SQL multi-bulan: jika baris di database memiliki bulan berbeda dari data yang masuk, database MENOLAK menimpa `no_sales_order`, `customer_name`, `items_json`, dan `transaction_date` pada kunci dasar.
     - **Larangan Hardcode Rentang Nomor Faktur di Backend**: Backend DILARANG KERAS menebak atau memaksa pembuatan key `__` berdasarkan rentang angka nomor faktur (misal `24000-38500`), dan wajib memastikan faktur ORA selalu mempertahankan suffix `-1P`.
     - **Client-Side Item Guard (`dbRowsToFakturRecords`)**: Jika tanggal transaksi ber-Order Date Oktober, parser dilarang keras membaca `it.order_number` yang numerik (`170%` / `171%`) dari sisa rincian barang November. Nilai No SO wajib terkunci ke `r.no_sales_order` DOO asli (`ELZDZ2-...`).
     - **Client-Side Merge Guard (`mergeKumulatifDocs`)**: Saat sinkronisasi delta, baris dengan beda bulan dilarang mewariskan list `items` lama ke baris baru.
     - **Self-Healing Otomatis Cache**: Saat inisialisasi IndexedDB, jika terdeteksi baris Order Date Oktober yang masih menyimpan SO numerik November, cache lokal seketika dihapus otomatis dan menyinkronkan ulang data bersih dari TiDB.
9. **Kewajiban Membaca File Upload Secara Lengkap & Larangan Mutlak Berasumsi / Menebak (Full-Read & Zero-Assumption Mandate - LOCKED TOTAL)**:
   - **Wajib Membaca Lengkap 100% Isi File**: Sistem wajib membaca secara utuh, teliti, dan lengkap seluruh lembar (*sheets*), baris, dan kolom dari file yang diupload (`No Invoice AR`, `Order Number`, `Reference Order Number`, `Nama Pelanggan`, `Kode Pelanggan`, `Entity / Business Unit`, `Jenis Transaksi / Source`, `Order Date`, `Transaction Date`, `Item Code`, `Item Description`, `Qty`, `UOM`, `Lot Number`, `Total Harga`, `Segmentation`, dan `Nama Kategori Product`).
   - **Dilarang Keras Berasumsi atau Menebak (Zero Guessing)**:
     - Sistem DILARANG KERAS berasumsi atau menebak data di luar apa yang tertulis secara eksplisit di dalam file yang diupload dan aturan baku di dokumen ini.
     - DILARANG menebak jenis transaksi atau membuat kunci komposit (`__`) berdasarkan asumsi rentang nomor invoice.
     - DILARANG menebak status cetak berdasarkan nomor urut invoice.
     - DILARANG memecah satu nomor faktur pada bulan yang sama menjadi dua baris terpisah.
   - **Kepatuhan Mutlak**: Seluruh modul aplikasi (`lib/parser.ts`, `app/page.tsx`, `lib/firestoreService.ts`, `app/api/tidb/route.ts`) WAJIB tunduk 100% pada aturan yang telah ditetapkan di `LOCKED_RULES.md`.

#### B. Jaminan Status Faktur Baru & Retensi Faktur Belum Dicetak (Unprinted Guarantee - LOCKED TOTAL)
1. **Aturan Mutlak Faktur Baru**:
   - Seluruh faktur baru yang **belum pernah terdaftar di database** (`existingEntry === undefined` & `prevInfo === undefined`) **WAJIB 100% berstatus Belum Dicetak (`status_cetak: false`, `printed_at: null`)** dan langsung dimasukkan ke `newUnprintedKeysSet` untuk ditampilkan di tab **"Belum Terprint"**.
   - **LARANGAN MUTLAK LOGIKA `isHistorical` (`num <= prevMaxNum`)**: DILARANG KERAS mengasumsikan faktur baru sebagai "sudah tercetak" hanya karena nomor invoicenya lebih kecil atau sama dengan nomor invoice yang sudah ada di database. Setiap faktur baru wajib diverifikasi fisik oleh operator sampai tombol Done Print diklik.
2. **Retensi Mutlak Faktur Belum Dicetak (Anti-Accidental Print)**:
   - Faktur yang saat ini sedang menunggu dicetak (`status_cetak: false`) **DILARANG BERUBAH MENJADI SUDAH TERCETAK** ketika ada file baru (seperti file `XXCUST` atau `export`) yang hanya memuat sebagian transaksi. Seluruh daftar faktur yang belum dicetak wajib tetap diawetkan statusnya sampai pengguna secara fisik menandai cetak.
3. **Pemisahan Partisi Suffix -1P (`getPrintPartitionId`)**:
   - Penentuan partisi wajib membuang suffix `-1P` (`replace(/-[0-9]P$/i, '')`) sebelum mengambil digit angka. Faktur ORA `18034-1P` wajib dipetakan ke partisi aslinya (`part_15000_19999`), dilarang melompat ke partisi sepuluh kali lipat (`part_180000_184999`).
4. **Tugas Utama Upload XXCUST**:
   - Mencari No Invoice dan No SO baru (khususnya ORA baru) dan mendaftarkannya ke sistem dengan status Belum Terprint.
   - Melengkapi No SO resmi dan rincian obat/item untuk faktur yang sudah ada.
   - Dilarang mereset atau mengutak-atik status cetak faktur apa pun yang sudah ada di database.
5. **Jaminan Konsistensi Kronologis (Chronological Consistency Guard - LOCKED)**:
   - Sebuah faktur baru tidak mungkin dicetak berhari-hari sebelum tanggal ordernya (`order_date`) dibuat.
   - Jika suatu faktur baru dicocokkan dengan stempel `printed_at` di database yang tanggalnya lampau (> 24 jam sebelum `order_date`), sistem secara otomatis mengabaikan stempel lampau tersebut (`isStalePrintTimestamp = true`) dan mewajibkan faktur baru tersebut berstatus murni `Belum Terprint`.
   - Menjamin 100% tidak ada lagi tabrakan nomor faktur antar siklus waktu yang menyebabkan faktur baru otomatis tercentang.

#### C. Logika Done Print & Realtime Multi-Device Sync
- **Kecepatan & Keandalan**:
  - Saat faktur ditandai selesai cetak (*Done Print*), status langsung tersimpan ke dokumen `app_data/print_state` di Firestore secara instan (<50ms).
  - Melalui listener `subscribeToFakturs`, seluruh device lain yang sedang membuka aplikasi akan menerima status terbaru secara *real-time* tanpa perlu reload halaman.
- **Filter Otomatis**:
  - Pada tab **"Belum Terprint"**, saat halaman direfresh atau difilter ulang, faktur yang sudah selesai dicetak **otomatis disaring keluar / tidak ditampilkan lagi** di daftar belum terprint.
  - Faktur tersebut tetap dapat dilihat di tab **"Sudah Terprint"**, tab **"Semua"**, atau melalui kotak pencarian global.

#### D. Jaminan Anti-Muncul Kembali (Anti-Reappearance & Permanent Print Retention - LOCKED MUTLAK)
1. **Faktur yang Sudah Selesai Dicetak DILARANG KERAS Muncul Kembali di Daftar Belum Terprint**:
   - Sekali suatu faktur ditandai `Done Print` (`✓`), status tersebut bersifat permanen di database `print_state_partitions` dan memori lokal.
   - Mengupload ulang file export yang sama, file kumulatif, file sebagian, ataupun file format lain **TIDAK BOLEH mereset atau mengembalikan faktur yang sudah dicetak ke status Belum Terprint**.
   - Faktur hanya bisa kembali ke status Belum Terprint jika user secara manual dan eksplisit mengklik tombol **"Unprint / Batalkan Print"** pada faktur tersebut.
2. **Pencegahan Stale Closure via Mutable Reference (`useRef` + `getLivePrintState`)**:
   - Handler upload (`handleUpload`) DILARANG KERAS hanya membaca state closure React yang rentan kosong/usang. Wajib selalu membaca referensi mutabel real-time `printedInvoicesRef.current`, `printedAtMapRef.current`, dan fungsi cache memori `getLivePrintState()`.
   - Setiap perubahan status cetak (baik per baris via spasi/tombol, *Batch Done Print*, maupun sinkronisasi Firestore) WAJIB memperbarui `printedInvoicesRef.current` detik itu juga secara sinkron.
3. **Larangan Mutlak Loop Penghapusan di `saveFaktursBatch` (Zero-Unprint on Upload)**:
   - Di dalam fungsi `saveFaktursBatch`, operasi penghapusan status cetak (`unifiedPrintedSet.delete(k)`) **DILARANG KERAS / DIHARAMKAN SECARA TOTAL**.
   - Kumpulan status cetak gabungan (`unifiedPrintedSet`) WAJIB selalu bersifat kumulatif (`Set([...livePrintedKeys, ...localPrintedKeys])`). Tidak ada mekanisme upload apa pun yang diizinkan membatalkan atau mencabut status cetak yang sudah ada di database.


#### E. Kategorisasi Prioritas & Penyimpanan Kustom Apotek (Category Overrides Retention)
1. **Default Kategori**:
   - **1P**: PT Helios (ORA) + Apotek Prioritas 1 DOO (`HALOMEDIKA`, `MEDIKA PRIMA`, `SBS`, `PASTI HEMAT`, `MEDIKA AKSES`).
   - **2P**: Apotek Prioritas 2 (dicek via master `master2P.json` berdasarkan Ship-to Site ID / Nama Apotek).
   - **3P**: Seluruh apotek reguler lainnya.
2. **Penyimpanan Kustom User (`category_overrides`)**:
   - Jika pengguna mengubah kategori suatu apotek/faktur (misal Apotek A diubah dari 3P ke 2P), perubahan tersebut disimpan permanen ke dokumen `app_data/category_overrides`.
   - **Saat upload file excel baru di masa depan**, sistem wajib memprioritaskan preferensi yang tersimpan sehingga Apotek A **tetap 2P dan tidak akan kembali ke 3P**.
3. **Kategori Produk Dominan (Dominant Category Majority Rule - LOCKED TOTAL)**:
   - **Kalkulasi Berbasis Mayoritas**: Kategori produk pada faktur dihitung berdasarkan kategori terbanyak dari seluruh item obat/barang dalam faktur tersebut:
     - Barang dominan FARMA $\rightarrow$ Kategori Faktur **FARMA**.
     - Barang dominan ALKES $\rightarrow$ Kategori Faktur **ALKES**.
     - Begitu juga untuk **CCP**, **PREKURSOR**, dan **OOT**.
   - **DILARANG KERAS Menghakimi Sepihak**: Dilarang mencap seluruh faktur sebagai ALKES hanya karena terdapat 1 item alkes (misal alkohol/swab) sementara 20 item lainnya adalah obat farmasi.
   - **Prioritas Tie-Breaker**: Jika jumlah item antar kategori sama persis, urutan penentu adalah `CCP > PREKURSOR > OOT > FARMA > ALKES`.
   - **Dukungan Resmi Oracle PPIC & Bentuk Sediaan**: Sistem wajib membaca kolom resmi Oracle PPIC (Kolom 16 `Segmentation` & Kolom 13 `Nama Kategori Product`) serta memprioritaskan bentuk sediaan farmasi (`TABLET`, `KAPSUL`, `SIRUP`, `INJEKSI`, `SALEP`, `KRIM`, `INFUS`, dll) agar obat farma tidak salah terbaca alkes.

#### F. Navigasi & Shortcut Keyboard
- Navigasi tabel penuh: `↓`/`j`, `↑`/`k` (baris), `→`/`l`, `←`/`h` (kolom/sel).
- Aksi instan: `Space` (toggle print), `Enter` (buka detail obat), `Ctrl+C` / `Cmd+C` / `c` (salin No Invoice / No SO / Pelanggan / Total pada sel aktif ke clipboard), `/` atau `f` (fokus search).

#### G. Dual Source of Truth Status Cetak & Jaminan Anti-Flash (Anti-Glitch / Anti-Race Condition - LOCKED)
1. **Strict Key Isolation Evaluasi Status Cetak di UI**:
   - Atribut `status_cetak: boolean` dan `printed_at: string | null` WAJIB ditanamkan langsung pada setiap objek `FakturRecord`.
   - Logika penentuan status cetak di UI (`grouped`, tabel, dan counter) WAJIB menggunakan evaluasi murni kunci masing-masing:
     `allPrinted: printedInvoices.has(g.key)`
   - DILARANG KERAS melakukan fallback atau cross-matching ke nomor invoice polos (`g.invoiceNumber`) pada faktur ORA. Faktur ORA `20078-1P` dan faktur DOO `20078` adalah dua entitas terpisah yang 100% mandiri dan dilarang diubah barengan.
2. **Persistensi Dua Arah ke Dokumen Chunk Firestore (Bidirectional Chunk Persistence - LOCKED)**:
   - Setiap kali status cetak diubah (baik cetak maupun unprint), sistem WAJIB memperbarui dokumen fisik chunk `faktur_chunks/chunk_{idx}` di Firestore secara langsung selain dokumen partisi `print_state_partitions`.
   - Menjamin status unprint tersimpan permanen dan tidak akan pernah mental kembali ke status sudah dicetak saat halaman direfresh.
3. **Penghitungan Notifikasi Banner Upload Akurat (Brand New Counter - LOCKED)**:
   - Angka `Faktur Baru Masuk` pada banner notifikasi upload WAJIB secara ketat hanya menghitung faktur yang benar-benar baru masuk dari file yang sedang diunggah (`brandNewUnprintedKeysSet`), bukan menghitung seluruh akumulasi antrean lama di database.
4. **Auto-Rescue Status Cetak Dokumen**:
   - Setiap kali chunk faktur dimuat (`emitData("chunks")` di `firestoreService.ts`), seluruh record yang memiliki `status_cetak: true` wajib secara otomatis digabungkan (*auto-rescue*) ke dalam set cetak di memori (`currentPrintState`).
5. **Optimistic Instant Upload (< 100ms UI Response)**:
   - Saat pengguna mengunggah file (Export / XXCUST), UI wajib langsung menampilkan perubahan dan membuka blokir loading secara instan (< 100ms) setelah file selesai diparsing.
   - Penyimpanan ke Firestore (`saveFaktursBatch`) berjalan di latar belakang (*background persistence*) tanpa menahan UI pengguna.

---

#### H. Master Produk & Category Overrides Retention (LOCKED TOTAL)
1. **Fitur Master Produk**:
   - Pengguna admin dapat mencari, memfilter, dan mengubah kategori produk (`FARMA`, `ALKES`, `CCP`, `PREKURSOR`, `OOT`) langsung melalui modal Master Produk atau inline dropdown pada baris detail faktur.
   - Perubahan disimpan permanen ke dokumen `app_data/product_category_overrides` di Firestore.
2. **Jaminan Anti-Kembali ke Awal Saat Upload File Baru**:
   - Fungsi `getProductCategory`, `parseXXCUST`, dan `parseExcelFile` WAJIB selalu membaca dan memprioritaskan pemetaan dari `product_category_overrides`.
   - Kategori produk yang telah diubah secara kustom oleh pengguna TIDAK BOLEH kembali ke nilai default saat file excel baru diunggah di kemudian hari.

#### I. Sistem Hak Akses Pengguna & Keamanan Password (User Roles & Auth - LOCKED)
1. **Daftar Pengguna Resmi**:
   - Pengguna Admin (Full Access): `Farhan`, `Rendy`, `Afuan`, `Aqsal`, `Wibi`, `Andre`, `Melin`, `Mahendra`.
   - Pengguna Tamu: `stranger` (Akses Read Only).
2. **Pengamanan Password Mandiri**:
   - Verifikasi password tersimpan aman di Firestore `app_data/user_credentials`.
   - Pengguna admin dapat mengganti password masing-masing kapan saja melalui tombol **Password** (`🔑`).
   - Sesi pengguna tersimpan di `sessionStorage` sehingga saat tab direfresh tidak perlu login ulang.
3. **Pembatasan Ketat Akses Stranger (Read Only Protection)**:
   - Pengguna `stranger` dilarang keras melakukan aksi operasional: dilarang upload file, dilarang menandai cetak (Done Print), dilarang mereset data, dan dilarang mengubah kategori apotek/produk.

#### J. Fitur Reset Data Terkendali (Admin Safe Reset)
- Tombol **Reset Data** (`🗑️ Reset Data`) tersedia khusus untuk pengguna Admin dengan dialog konfirmasi keamanan bertingkat.
- Saat reset disetujui, seluruh dokumen faktur di cloud dan memori lokal dibersihkan serentak secara bersih tanpa sisa (*clean slate*).

#### K. Aturan Baku Urutan Hook React (React Hook Order & Anti-Crash Guarantee - LOCKED MUTLAK)
- **LARANGAN MUTLAK KONDISIONAL HOOK**: DILARANG KERAS menempatkan `useState`, `useEffect`, `useMemo`, `useCallback`, atau `useRef` setelah pernyataan `if (...) return null;` atau di dalam blok kondisional apa pun.
- Seluruh hooks WAJIB dideklarasikan di level teratas (*top-level*) fungsi komponen. Pelanggaran aturan ini memicu *React Error #300 ("Rendered fewer hooks than expected")* yang membuat aplikasi crash menjadi tampilan error biru di browser pengguna.

#### L. Arsitektur Performa Super Cepat & Eliminasi Spinner Palsu (Performance Lock - LOCKED)
1. **Pemisahan `baseGroups` vs `grouped` (<1ms Action Speed)**:
   - Pengelompokan baris data, kalkulasi harga, dan penyusunan string pencarian (`searchStr`) WAJIB diisolasi dalam `baseGroups` yang hanya dieksekusi saat `records` berubah.
   - Proyeksi status cetak (`grouped`) dilakukan secara *shallow* (<1ms), sehingga aksi klik tombol cetak (*Done Print*) berjalan seketika tanpa jeda dan tanpa mengulang proses berat.
2. **Pencarian Kilat (Precomputed Search Index)**:
   - Setiap grup faktur memiliki atribut `searchStr` huruf kecil yang sudah dihitung sebelumnya. Pencarian mencocokkan string tunggal ini sehingga respon pencarian instan tanpa lag.
3. **Kalkulasi Kartu & Tab Berbasis `stats` (O(N) Precomputed Stats)**:
   - DILARANG menaruh pemanggilan `.filter()` berulang kali di dalam JSX render body. Seluruh angka kartu KPI dan filter tab dihitung dalam 1 putaran ringkas `stats` di memori.
4. **Eliminasi Spinner Loading Berputar yang Macet**:
   - Indikator spinner "Memuat data faktur..." HANYA boleh muncul jika `records.length === 0` (saat awal membuka web ketika data belum masuk ke memori).
   - Begitu data ada di memori (`records.length > 0`), tabel DILARANG menampilkan spinner loading, melainkan langsung menampilkan data atau keterangan kosong yang ramah jika tidak ada data yang sesuai filter (contoh pada tab Belum Terprint: `🎉 Semua faktur sudah dicetak`).
5. **Navigasi Keyboard Bebas Lag & Anti-Crash (Keyboard Navigation Guard - LOCKED)**:
   - Handler keyboard (`handleKeyDown`) WAJIB terpasang satu kali saja (*zero listener churn*) dengan dependensi kosong `[]`, memanfaatkan `useRef` untuk membaca state dinamis.
   - Tombol spasi (`Space`), `Enter`, `PageUp`, `PageDown`, dan `c` WAJIB mengabaikan `e.repeat` untuk mencegah penumpukan eksekusi saat tombol ditahan.
   - Tombol spasi memiliki *throttle/debounce guard* (150ms) untuk mencegah banjir operasi penulisan concurrent.
   - Elemen interaktif (`INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `contentEditable`) dan modal aktif WAJIB memblokir eksekusi pintasan tabel agar tidak terjadi eksekusi ganda yang memicu crash.
   - Navigasi panah atas/bawah (`ArrowDown`, `ArrowUp`, `j`, `k`) menggunakan `requestAnimationFrame` dan `scrollIntoView({ block: 'nearest' })` untuk pergerakan baris yang mulus tanpa lag.
6. **Debounced Background Chunk Persistence & Anti-Echo Guard (LOCKED)**:
   - Penyimpanan dokumen chunk (`faktur_chunks`) pada pengubahan status cetak dijalankan secara *debounced* (1.000ms) di latar belakang agar tidak memblokir thread JavaScript utama.
   - Listener real-time Firestore `unsubChunks` WAJIB mengabaikan echo snapshot dari update chunk internal (`internalChunkWriteInProgress`), mencegah re-parsing rekursif ribuan data yang memicu crash tab browser.
7. **Pengurutan Tab 'Semua' (Unprinted-First & Chronological Done-Print Stream - LOCKED)**:
   - Tab 'Sudah Terprint' disederhanakan/dihapus dari bilah filter utama agar tampilan bersih dan fokus pada antrean kerja.
   - Pada tab 'Semua', faktur yang **Belum Terprint** selalu berada di posisi paling atas (diurutkan nomor invoice terbaru).
   - Faktur yang **Sudah Terprint** mengalir di bawahnya, diurutkan secara ketat berdasarkan **waktu cetak (Done Print timestamp)** terbaru ke terlama (`timeB - timeA`). Saat faktur selesai dicetak, faktur tersebut langsung turun memimpin daftar riwayat cetak.

#### M. Aturan Baku Multi-Gudang (Gudang MBI vs Gudang MAI) & Validasi Upload XXCUST Terkunci (LOCKED TOTAL)
1. **Dua Entitas Gudang Mandiri (MBI & MAI)**:
   - **Gudang MBI**: Ditentukan secara resmi dari data Entity Oracle `MBI LE` / `MBI Business Unit` (PT Medikabina Investama).
   - **Gudang MAI**: Ditentukan secara resmi dari data Entity Oracle `MAI LE` / `MAI Business Unit` (PT Medikabina Alkesindo Investama).
2. **Navigasi Header Daftar Faktur (Hanya Pilihan MBI dan MAI - Tanpa Opsi Semua)**:
   - Di header modul Daftar Faktur, pilihan yang disediakan **HANYA `MBI` dan `MAI`** (DILARANG membuat opsi "Semua Gudang" / gabungan).
   - Pengguna memilih gudang kerja secara eksplisit: beralih ke `MBI` atau `MAI`.
   - Preferensi pilihan tersimpan di penyimpanan browser (`localStorage`), sehingga komputer/perangkat di Gudang MBI akan selalu otomatis membuka MBI, dan perangkat di Gudang MAI selalu membuka MAI.
   - Seluruh metrik KPI (*Total Faktur, Total SO, Belum Terprint, Double SO, Retur, Max Invoice progression*) dan tabel data faktur 100% difilter eksklusif hanya untuk gudang yang sedang aktif.
3. **Validasi File Upload Ketat (Hanya File XXCUST Resmi)**:
   - File yang diizinkan untuk diunggah **HANYA file XXCUST resmi** yang memiliki penanda `Entity` (`MBI LE` atau `MAI LE`) pada baris header metadata atau kolom data `Entity` / `Business Unit`.
   - Segala bentuk file lain (export mentah tanpa Entity, file HTML lama, dll) **WAJIB DITOLAK SECARA OTOMATIS**.
4. **Proteksi Anti-Tertukar / Mismatch Rejection (WAJIB TOLAK JIKA BEDA GUDANG - LOCKED MUTLAK)**:
   - **Jika operator sedang membuka tab Gudang `MBI`**, lalu mengunggah file yang memuat Entity `MAI LE`:  
     **SISTEM WAJIB 100% MENOLAK UPLOAD TERSEBUT** dan memunculkan peringatan:  
     `"⚠️ File Ditolak: Anda sedang membuka Gudang MBI, tetapi file yang diunggah adalah Entity MAI LE! File ditolak untuk mencegah data tercampur."`
   - **Jika operator sedang membuka tab Gudang `MAI`**, lalu mengunggah file yang memuat Entity `MBI LE`:  
     **SISTEM WAJIB 100% MENOLAK UPLOAD TERSEBUT** dan memunculkan peringatan:  
     `"⚠️ File Ditolak: Anda sedang membuka Gudang MAI, tetapi file yang diunggah adalah Entity MBI LE! File ditolak untuk mencegah data tercampur."`
   - Tidak ada toleransi pencampuran data: file yang tidak sesuai dengan gudang aktif tidak boleh diproses, disimpan ke memori, ataupun ditulis ke database.
5. **Isolasi Mutlak Kunci Faktur Lintas Entitas (Strict Multi-Warehouse Key Isolation)**:
   - Faktur MBI:
     - DOO: `${cleanInv}` (contoh: `24000`)
     - ORA: `${cleanInv}-1P` (contoh: `24000-1P`)
   - Faktur MAI:
     - DOO: `MAI-${cleanInv}` (contoh: `MAI-24000`)
     - ORA: `MAI-${cleanInv}-1P` (contoh: `MAI-24000-1P`)
   - Tampilan nomor invoice ke operator tetap bersih hanya nomor faktur asli (`24000`), sementara kunci unik database terisolasi 100% sehingga tidak akan pernah terjadi tabrakan status cetak antar MAI dan MBI.
6. **Tampilan Teks Sederhana di Tabel**:
   - Cukup tampilkan teks nama gudang secara ringkas dan bersih pada baris tabel (contoh: `DOO · MBI` atau `ORA · MAI`) tanpa ornamen berlebihan.
7. **Pemisahan Kamus Master Apotek 2P/3P MBI vs MAI (Strict Master Customer Isolation - LOCKED MUTLAK)**:
   - Master apotek dan klasifikasi 2P vs 3P antara entitas MBI dan MAI **DIISOLASI 100% SECARA MANDIRI**.
   - **Master MBI**: Menggunakan `lib/master2P.json` dan `lib/masterApotek.json`.
   - **Master MAI**: Menggunakan `lib/masterApotek_MAI.json` dan `lib/master2P_MAI.json` yang bersumber resmi dari tab MASTER MAI (4.518 apotek terdaftar).
   - Fungsi klasifikasi `categorize(jenisTransaksi, customerName, sourceFile, shipToSite, billToSite, entity)` WAJIB mengevaluasi strictly sesuai entitas gudangnya (`entity === "MAI"` menggunakan kamus master MAI, dan `entity === "MBI"` menggunakan kamus master MBI).
   - Klasifikasi 2P/3P pada MAI tidak boleh mempengaruhi MBI, begitu pula sebaliknya.


---

### 2. ARSITEKTUR DATABASE & ZERO LOCALSTORAGE

- **DILARANG MENGGUNAKAN `localStorage`** untuk menyimpan records, progression, ataupun status cetak, agar sinkronisasi 100% konsisten multi-device.
- **Skema Koleksi Firestore**:
  1. `app_data/metadata`: Menyimpan `invoiceProgression`, `totalInvoices`, `totalChunks`, `chunkIds`, `updatedAt`, `lastUploadNotification`.
  2. `app_data/print_state_partitions`: Status cetak dipecah per partisi (5.000 key per partisi) untuk menjamin kapasitas puluhan ribu faktur tanpa batas limit Firestore.
  3. `app_data/category_overrides`: Menyimpan pemetaan kustom kategori apotek/faktur (`1P`, `2P`, `3P`).
  4. `app_data/product_category_overrides`: Menyimpan pemetaan kustom kategori produk (`FARMA`, `ALKES`, `CCP`, `PREKURSOR`, `OOT`).
  5. `app_data/user_credentials`: Menyimpan password pengguna terenkripsi.
  6. `app_data/active_presence`: Menyimpan heartbeat real-time siapa saja pengguna yang sedang ON.
  7. `faktur_chunks/chunk_{idx}`: Menyimpan data faktur yang dipecah per chunk (<500 KB per chunk).

---

### 3. ARSITEKTUR EFISIENSI EKSTRIM & PORTABILITAS DATABASE (DATABASE MIGRATION & EXTREME EFFICIENCY - LOCKED)

Dokumen ini secara permanen mengunci prinsip efisiensi kuota dan kompresi data untuk database saat ini (Firestore) maupun jika sistem dipindahkan ke database lain di masa mendatang:

1. **Prinsip Chunking Portabel (Portable Document Chunking - LOCKED)**:
   - Jika database dipindahkan (misal ke project Firebase baru, Supabase, PostgreSQL, CouchDB, MongoDB, dll), logika **Chunking (~200 s/d 250 faktur per kantung dokumen)** WAJIB TETAP DIPERTAHANKAN.
   - **Alasan**: Menghindari pemborosan kuota baca (reads/queries). Membaca 10.000 faktur hanya membutuhkan ~40 s/d 50 reads dokumen, bukan 10.000 reads individual.
2. **Pembersihan Data Mentah di Browser (Client-Side Extreme Data Pruning - LOCKED)**:
   - File dari Oracle (berukuran 20 MB – 30 MB+) WAJIB langsung dibersihkan di memori browser pengguna sebelum dikirim ke database:
     - Seluruh kolom sampah (session ID, token sistem Oracle, batch ID internal, format styling XML) dibuang 100%.
     - Hanya 7 atribut inti yang disimpan: No Invoice, No SO, Nama Pelanggan, Nama Barang, Qty, Satuan, Total Harga.
     - Rincian item dikelompokkan ke dalam array ringkas `extra.items` per invoice, mencegah pengulangan nama apotek dan invoice yang redundan.
   - **Hasil**: Ukuran data mengecil drastis 90%–95% (dari puluhan MB menjadi hanya ~1–2 MB di database cloud).
3. **Isolasi Mutlak Operasi Tulis Cetak (Partitioned Print State Writes - LOCKED)**:
   - Status cetak dan timestamp selesai cetak WAJIB diisolasi pada dokumen partisi terpisah (`print_state_partitions`).
   - Menandai cetak faktur HANYA menulis dokumen kecil (< 5 KB), dan DILARANG KERAS memicu penulisan ulang seluruh chunk data faktur.
4. **Pemrosesan Murni di Memori Klien (Zero-Read Filtering & Sorting - LOCKED)**:
   - Seluruh operasi pencarian keyword, filtering (ALKES, OOT, CCP, PREKURSOR, FARMA, Belum Cetak, Retur), pengurutan, dan paginasi WAJIB diproses 100% di memori browser (RAM perangkat).
   - Memastikan **0 reads tambahan** ke database saat pengguna berinteraksi dengan tabel.

---

---

### 4. ARSITEKTUR HYBRID DUAL-SYNC REALTIME (TIDB + FIREBASE - LOCKED MUTLAK)

1. **Pemisahan Peran Tegas (Separation of Concerns)**:
   - **TiDB Cloud Serverless (Primary Authoritative Archive)**:
     - Menyimpan seluruh 15.000+ hingga jutaan master record faktur secara permanen di cloud (kapasitas 25 GB).
     - Menjadi sumber kebenaran data (*Single Source of Truth*) untuk data historis, sinkronisasi delta berkala, dan pemuatan awal aplikasi.
   - **Firebase Cloud Firestore (Real-Time Dispatcher & Walkie-Talkie)**:
     - Bertanggung jawab 100% atas komunikasi kilat antar-perangkat (< 50ms).
     - **Done Print Realtime Sync**: Mengirim status cetak faktur detik itu juga antar-laptop via `print_state_partitions`.
     - **Realtime Upload Broadcast (`broadcastRecentUpload`)**: Saat salah satu admin mengunggah file faktur baru, data faktur baru tersebut WAJIB langsung disiarkan detik itu juga melalui dokumen `app_data/recent_sync`.
     - Seluruh laptop rekan yang sedang online WAJIB langsung menangkap siaran tersebut, menampilkan banner toast upload, dan menyisipkan faktur baru langsung di posisi teratas tab **"Belum Terprint"** secara instan tanpa perlu me-refresh halaman.

2. **Jaminan Paritas Data Latar Belakang (Background Delta Parity Guard)**:
   - 1 detik setelah notifikasi upload Firebase diterima, perangkat rekan secara otomatis mengeksekusi `fetchTiDBDelta(clientUpdated)` di latar belakang untuk menjamin keselarasan 100% rincian item, nomor SO, dan lot produk dari TiDB tanpa memblokir antarmuka pengguna.

3. **Proteksi Sanitasi Data Uji Coba (Test Data Sanitization Guard - LOCKED)**:
   - Data faktur uji coba atau data berawalan prefix `TEST-` secara ketat dilarang masuk ke dalam memori aplikasi, dilarang masuk ke tabel kerja, dan otomatis disaring dari penyimpanan lokal IndexedDB.

---

### 6. ARSITEKTUR INTEGRASI QC (CHECKER, PACKER, & PICKER) DARI GOOGLE SHEET (LOCKED TOTAL)

Aturan ini mengunci secara mutlak arsitektur integrasi data petugas gudang (Checker, Packer, dan Picker) antara Google Spreadsheet dan Aplikasi Fantastic Order dengan **ISOLASI DUA GUDANG (MBI & MAI) 100% TERPISAH**:

1. **Pemisahan Sumber Data Gudang MBI vs Gudang MAI (Dual Warehouse Isolation - LOCKED MUTLAK)**:
   - **GUDANG MBI (PT Medika Bina Investama)**:
     - **Sumber Spreadsheet**: Google Spreadsheet **`REPORT QC`** (URL ID: `1wCbPpkVM2rI_axg-sOB8n_4hmsXGOXwU4ARwaks4p8g`).
     - **Tab Resmi**: HANYA tab **`Rekap Lengkap`** (GID spesifik: `1198696917`).
     - **Pemetaan Kolom MBI**:
       - Kolom A: `Tanggal SO` (Diabaikan)
       - Kolom B: `No SO Selesai` $\rightarrow$ Nomor SO (`so_number`)
       - Kolom C: `Checker` $\rightarrow$ Nama Checker (`checker_name`)
       - Kolom D: `Packer` $\rightarrow$ Nama Packer (`packer_name`)
       - Kolom E: `Picker` $\rightarrow$ Nama Picker (`picker_name`)
     - **Penyimpanan Database**: Tabel TiDB Serverless `so_checkers` dan channel Firestore `app_data/so_checkers_recent`.
   - **GUDANG MAI (PT Medika Akses Investama)**:
     - **Sumber Spreadsheet**: Google Spreadsheet **`Report QC MAI`** (URL ID: `1mFptY9OxIkP0oIW9C31PdJ-GICCPXocv8AXAu8vJ0WQ`).
     - **Tab Resmi**: HANYA tab **`Rekap Lengkap`** (GID spesifik: `746703007`).
     - **Pemetaan Kolom MAI**:
       - Kolom A: `Tanggal SO` (Diabaikan)
       - Kolom B: `No SO` $\rightarrow$ Nomor SO (`so_number`)
       - Kolom C: `Picker` $\rightarrow$ Nama Picker (`picker_name`)
       - Kolom D: `Checker` $\rightarrow$ Nama Checker (`checker_name`)
       - Kolom E: `Packer` $\rightarrow$ Nama Packer (`packer_name`)
     - **Penyimpanan Database**: Tabel TiDB Serverless `so_checkers_mai` dan channel Firestore `app_data/so_checkers_recent_mai`.
   - **Isolasi Mutlak di UI**: Data QC MBI DILARANG KERAS merembes atau ditampilkan pada faktur MAI, begitu pula data QC MAI DILARANG KERAS merembes ke MBI. Evaluasi `getCheckerInfo` wajib strictly mengecek entitas faktur (`entity === 'MAI'` ke kamus MAI, selain itu ke kamus MBI).

2. **Aturan Kekosongan Nama (Empty / Blank Rule - LOCKED TOTAL)**:
   - **JIKA TIDAK ADA NAMA, WAJIB DIKOSONGKAN**: Jika nama Checker, Packer, atau Picker tidak diisi di Google Sheet (berupa sel kosong, tanda strip `-`, `#N/A`, atau spasi):
     - Sistem **WAJIB MENYIMPANNYA SEBAGAI `NULL` / KOSONG**.
     - Di tampilan tabel aplikasi **WAJIB TAMPIL SEBAGAI TANDA STRIP KOSONG (`-`)**.
   - **LARANGAN KERAS MENEBAK ATAU MENGAMBIL DATA TETANGGA**:
     - DILARANG KERAS mengambil nama pelanggan/apotek untuk mengisi Packer atau Picker.
     - DILARANG KERAS mengambil tanggal/waktu untuk mengisi Packer atau Picker.
     - DILARANG KERAS mengisi nama fiktif/asumsi. Jika belum ada yang mengerjakan, kolom tersebut HARUS kosong (`-`).

3. **Filter Sanitasi Berlapis Anti-Bocor (Multi-Layer Sanitization Guard - LOCKED)**:
   - Berlaku di 3 lapisan: (1) Google Apps Script, (2) Backend API TiDB (`/api/tidb`), dan (3) Frontend Web App (`app/page.tsx` & `lib/firestoreService.ts`).
   - Setiap nilai pada Packer atau Picker yang terdeteksi:
     - Diawali `Apotek`, `PT `, `Klinik`, `Rumah Sakit`, `Toko`, dll.
     - Mengandung format jam/tanggal: `00:00:00`, `GMT`, `WIB`, hari (`Mon`, `Tue`, `Wed`, dll), atau pola tanggal (`DD/MM/YYYY`).
     - **WAJIB OTOMATIS DIGUGURKAN / DIKOSONGKAN MENJADI NULL / EMPTY STRING**.

4. **Otoritas Data & Eliminasi Cache Kotor (TiDB Authority & Anti-Pollution Cache)**:
   - Database TiDB (`so_checkers` untuk MBI & `so_checkers_mai` untuk MAI) adalah satu-satunya otoritas kebenaran data (*Single Source of Truth*).
   - LocalStorage browser dan Firebase Firestore dilarang mendominasi atau menimpa data TiDB dengan data kotor/usang.
   - Aplikasi secara otomatis mendeteksi dan membersihkan cache localStorage jika terindikasi menyimpan data bocor.

5. **Pemisahan Sumber Data Murni & Proteksi Data Upload (Upload Data Sovereignty & Zero-Assumption Full-File Ingestion - LOCKED MUTLAK)**:
   - **Kewajiban Pembacaan Fisik Menyeluruh Tanpa Asumsi (Zero-Assumption Rule)**:
     - Setiap file Excel yang diunggah WAJIB dibaca secara utuh baris demi baris, kolom demi kolom, sel demi sel.
     - DILARANG KERAS menggunakan asumsi, menebak pola, memotong pembacaan baris, atau menahan nilai lama dari memori/riwayat.
   - **Data Utama Faktur (100% Hak File Excel Upload)**:
     - **Entity** (`MBI LE` vs `MAI LE`), Nomor SO (`Order Number`), Nomor Faktur (`No Invoice AR`), **Nama Apotek / Pelanggan** (`Nama Pelanggan` / `Nama Lokasi`), Tanggal Order (`Order Date`), Kategori Produk (Farma/Alkes), PBF (MAI/MBI), Kategori Apotek (1P/2P/3P), dan Nominal Harga **WAJIB 100% MURNI BERSUMBER DARI FILE EXCEL YANG DIUNGGAH OPERATOR**.
     - Wajib membaca kolom **Entity / Business Unit** dan metadata header untuk memastikan transaksi masuk ke gudang yang tepat (`MBI` atau `MAI`) dan ditolak jika salah gudang.
     - Google Sheet DILARANG KERAS menimpa, mengganti, atau merusak data utama faktur maupun Nama Apotek.
   - **Data Google Sheet QC (HANYA 3 Atribut Tambahan)**:
     - Google Sheet QC secara eksklusif HANYA memasok: **Nama Checker**, **Nama Packer**, dan **Nama Picker**.

6. **Pencocokan Cerdas Kolom B Multi-Identifier & Normalisasi '0' vs 'O' (Smart Multi-Key Matcher - LOCKED)**:
   - Karena di lapangan petugas gudang pada Kolom B Google Sheet terkadang menginput No Faktur / DOO (contoh: `OY99DY-3580`) alih-alih No SO murni (contoh: `33184`), serta sering tertukar mengetik huruf `O` dan angka `0`:
   - Fungsi pencocokan `getCheckerInfo` WAJIB memeriksa secara berlapis:
     1. Pencocokan langsung via Nomor SO (`so_number`).
     2. Pencocokan langsung via Nomor Faktur (`invoice_number` / `invoice_key`).
     3. Normalisasi ekuivalen huruf besar `O` dan digit angka `0` (contoh: `OY99DY` $\leftrightarrow$ `0Y99DY`).
   - DILARANG KERAS melakukan tebakan suffix 4 digit semata yang berisiko salah memasangkan nama petugas gudang. Pencocokan WAJIB 1:1 terhadap No SO lengkap atau No Faktur lengkap.
   - Dengan sistem pencocokan ini, nama Checker, Packer, dan Picker akan selalu ditemukan dan ditampilkan di tabel Fantastic Order tanpa merubah data No SO atau Nama Apotek asli yang diupload.

7. **Jaminan Kelengkapan Ingesti File & Integritas SO-Invoice Antara Report QC dan Daftar Faktur (Full-File Ingestion & SO-Invoice Integrity Guarantee - LOCKED TOTAL & PERMANEN)**:
   - **Latar Belakang & Larangan Masalah Berulang**:
     Dilarang keras terjadi kendala di mana suatu Sales Order (SO) yang sebenarnya sudah memiliki nomor faktur di file Oracle yang diunggah (contoh: `WY3M0L-1461` atau `WY3M0L-1015`) tertahan di antrean Report QC dengan label "Menunggu Faktur". Setiap SO yang fakturnya sudah terbit wajib otomatis keluar dari antrean Report QC dan langsung tampil di Daftar Faktur / Belum Terprint.
   - **Aturan 1: Larangan Mutlak Pembuangan No SO pada Transaksi ORA / Export (Zero SO Stripping)**:
     - DILARANG KERAS membuang, mengosongkan, atau mengubah Nomor Sales Order menjadi `"-"` pada transaksi apa pun, termasuk transaksi ORA atau transfer internal apotek.
     - Kode seperti `const finalSO = isOra ? "-" : ...` DIHARAMKAN SECARA TOTAL. Nilai No SO dari file export wajib dipertahankan murni apa adanya (`finalSO = soVal || "-"`).
   - **Aturan 2: Pembacaan Penuh Seluruh Sheet Workbook (Full Multi-Sheet Workbook Ingestion)**:
     - Parser file Excel (`parseExcelFile`) WAJIB mengekstrak seluruh tab/sheet yang memuat tabel transaksi (bukan hanya berhenti/return pada sheet pertama).
     - Data transaksi dari semua sheet yang valid wajib digabungkan secara kumulatif (`allRecords.push(...parsed)`).
   - **Aturan 3: Pewarisan No SO Multi-Baris & Fallback Kolom Referensi (Multi-Line SO Persistence & Reference Fallback)**:
     - Pada faktur dengan banyak baris item, jika sel No SO hanya tertulis di baris pertama, sistem WAJIB mewariskan (*carry forward*) No SO tersebut ke baris-baris item berikutnya dalam faktur yang sama, dan DILARANG KERAS menimpa memori No SO menjadi `"-"`.
     - Jika kolom `Order Number` kosong, sistem wajib memeriksa kolom fallback: `Reference Order Number`, `Ref Order No`, atau `No Ref Order`.
   - **Aturan 4: Deteksi Multi-Dimensi Antrean Report QC (`pendingQcList`)**:
     - Sistem mencocokkan No SO yang sudah memiliki faktur Oracle secara komprehensif:
       1. Pencocokan teks langsung (`trim().toUpperCase()`).
       2. Normalisasi alfanumerik bebas tanda hubung/spasi (`WY3M0L-1461` $\leftrightarrow$ `WY3M0L1461`).
       3. Pencocokan No SO yang tercatat di tingkat rincian item (`g.items`).
       4. Pemecahan No SO gabungan (koma, garis miring, spasi).
     - Jika sebuah SO sudah memiliki faktur di gudang yang aktif, SO tersebut 100% otomatis keluar dari antrean Report QC (*Menunggu Faktur*).
   - **Aturan 5: Dekopeling Status Selesai QC dari Google Sheet**:
     - Status QC pada tabel Report QC adalah kontrol operasional mandiri (toggle interaktif `⏳ PROSES` / `✓ DONE`) untuk mempermudah admin, dan TIDAK bergantung pada status sinkronisasi realtime Google Sheet.

---

### 7. ARSITEKTUR UPLOAD KILAT & EFISIENSI TINGGI (LIGHTNING-FAST UPLOAD ARCHITECTURE - LOCKED TOTAL)

Arsitektur upload cepat ini telah diuji dan terbukti memberikan respon kilat instan pada operasional harian, dan **DIKUNCI TOTAL (LOCKED TOTAL)** agar tidak ada perubahan kode di masa depan yang memperlambat alur ini:

1. **Optimistic Instant UI Update (< 100ms Response)**:
   - Saat pengguna mengunggah file Excel (XXCUST / Export), file langsung diparsing di memori lokal peramban (*client-side parsing*).
   - Antarmuka pengguna (tabel, kartu KPI, banner toast, dan daftar faktur baru) **WAJIB LANGSUNG TERUPDATE KETIKA PARSING SELESAI (< 100ms)** tanpa menunggu respon jaringan database cloud.
   - Operator gudang tidak pernah diblokir oleh indikator loading berputar yang lama saat mengupload file.

2. **Background Non-Blocking Batch Persistence**:
   - Penyimpanan data faktur baru ke TiDB Cloud Serverless (`/api/tidb?action=upsert_batch`) dan siaran realtime Firebase (`broadcastRecentUpload`) dijalankan secara asinkron di latar belakang (*background promise*).
   - Database menerima data dalam bentuk *Batch Chunked Upsert* (`INSERT ... ON DUPLICATE KEY UPDATE`) yang efisien, mencegah *request flood* per-baris.

3. **Pruning Data Ekstrem di Sisi Klien (Extreme Client-Side Data Pruning)**:
   - Sebelum payload dikirim ke server, memori browser secara otomatis memangkas seluruh kolom sampah/token Oracle XML dari file 20–30 MB menjadi format JSON ringkas (< 500 KB).
   - Pengiriman jaringan ke API Vercel menjadi sangat cepat, ringan, dan tidak membebani kuota Fast Origin.

4. **Pembaruan Langsung IndexedDB Lokal (Direct In-Memory & Local Cache Injection)**:
   - Faktur yang baru diunggah langsung disuntikkan ke dalam memori aplikasi aktif (`records`) dan cache lokal browser (**IndexedDB**) detik itu juga.
   - Sistem **DILARANG KERAS** memicu *full re-download* atau memanggil ulang arsip 35 MB dari database saat upload selesai.

---

### 8. KLAUSUL INTEGRITAS MUTLAK (INVIOLABILITY CLAUSE)

> **DILARANG MERUBAH LOGIKA DASAR PADA PERMINTAAN FITUR BARU APAPUN:**
> Setiap penambahan fitur, perubahan tampilan, atau optimasi di masa mendatang **WAJIB** tunduk pada dokumen `LOCKED_RULES.md` ini dan **TIDAK BOLEH** merusak atau mengubah:
> 1. Isolasi mutlak DOO vs ORA (`-1P`)
> 2. Jaminan anti-reappearance faktur yang sudah dicetak
> 3. Jaminan faktur baru masuk ke Belum Terprint
> 4. Real-time sync multi-device Firestore (Done Print + Realtime Upload Broadcast)
> 5. Retensi kustom kategori apotek dan produk
> 6. Aturan baku urutan Hook React (Top-Level Hooks Only)
> 7. Arsitektur performa kilat `baseGroups` dan eliminasi loading palsu
> 8. Sistem hak akses role pengguna dan proteksi stranger
> 9. Arsitektur efisiensi ekstrim (Chunking, Data Pruning, dan Zero-Read Client Filtering)
> 10. Arsitektur Hybrid Dual-Sync (TiDB Authoritative + Firebase Realtime Broadcast)
> 11. Integrasi QC Checker, Packer, & Picker: Tab Rekap Lengkap, aturan wajib kosong jika tanpa nama, dan sanitasi mutlak anti-bocor.
> 12. Proteksi Kedaulatan Data Upload: Nomor SO, Nomor Faktur, dan Nama Apotek 100% dari file Excel yang diunggah, Google Sheet hanya memasok Checker, Packer, dan Picker via Smart Multi-Key Matcher.
> 13. Larangan Mutlak Asumsi & Tebakan: Wajib membaca fisik file Excel secara lengkap baris demi baris (`Order Number`, `No Invoice AR`, `Nama Pelanggan`, `Order Date`) tanpa jalan pintas atau pemotongan data.
> 14. Jaminan Kelengkapan Ingesti File: Wajib membaca seluruh sheet workbook Excel tanpa ada yang terpotong.
> 15. Jaminan Zero SO Stripping: Dilarang membuang No SO pada ORA / export. No SO wajib dipertahankan utuh.
> 16. Integritas SO-Invoice Report QC: SO yang sudah memiliki faktur wajib otomatis keluar dari antrean Menunggu Faktur detik itu juga melalui pencocokan multi-dimensi.
> 17. Arsitektur Upload Kilat & Non-Blocking Persistence: Optimistic instant UI update (<100ms), pruning data client-side, dan direct in-memory cache injection tanpa full re-download.

