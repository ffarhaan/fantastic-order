# 🔒 MANDATORY PROJECT RULES (LOCKED_RULES.md ENFORCEMENT)

Setiap kali pengguna meminta perbaikan, optimasi performa, atau fitur baru pada repositori **Faktur Tracker (`fantastic-order`)**, agen AI **WAJIB** terlebih dahulu membaca (`read_file`) dan mematuhi seluruh aturan di [`LOCKED_RULES.md`](./LOCKED_RULES.md) **100% tanpa pengecualian**.

## Larangan Mutlak Tanpa Izin Eksplisit (Zero-Violation Policy)

1. **DILARANG KERAS Mengubah Logika Kunci Faktur (`invoiceKey`)**:
   - **DOO vs ORA (`-1P`)**: Faktur DOO wajib menggunakan `${cleanInv}` dan faktur ORA wajib menggunakan `${cleanInv}-1P`. Keduanya 100% terisolasi dan independen (dilarang melakukan fallback atau cross-matching).
   - **Gudang MBI vs Gudang MAI**: Faktur MBI menggunakan `${baseKey}`, sedangkan faktur MAI wajib menggunakan prefix `MAI-${baseKey}` (`MAI-${cleanInv}` untuk DOO, `MAI-${cleanInv}-1P` untuk ORA).
   - **Kunci Komposit (`__`)**: Kunci komposit `${baseTargetKey}__${cleanSO}` **HANYA** boleh dialokasikan jika terjadi tabrakan nomor faktur dengan **Tanggal Order (`order_date`) berbeda bulan** (`isDifferentMonth`) dan No SO berbeda. **DILARANG KERAS** memecah faktur pada bulan yang sama menjadi baris duplikat `__`, dan **DILARANG KERAS** menebak/memaksa pembuatan key `__` berdasarkan rentang angka nomor faktur.

2. **DILARANG KERAS Mengubah Logika Status Cetak Permanen (`status_cetak`)**:
   - Sekali faktur ditandai `Done Print` (`status_cetak: true`), status tersebut bersifat **permanen** di `print_state_partitions`, chunk Firestore, TiDB, dan memori lokal.
   - Upload file baru, sinkronisasi listener (`subscribeToFakturs`), maupun merge delta **DILARANG KERAS** me-reset, menghapus (`delete`), atau mengembalikan faktur yang sudah dicetak ke status `Belum Terprint`.
   - Sebaliknya, faktur baru yang belum pernah ada di database wajib 100% berstatus `Belum Terprint` (`status_cetak: false`), dan faktur yang sedang menunggu dicetak dilarang berubah menjadi sudah tercetak secara tidak sengaja.

3. **DILARANG KERAS Mengubah Cara Pembacaan File Upload (`Full-Read & Zero-Assumption Mandate`)**:
   - Wajib membaca 100% utuh seluruh *sheet* (multi-sheet workbook), baris, dan kolom dari file yang diupload tanpa memotong pembacaan atau berasumsi/menebak data.
   - Wajib mempertahankan prinsip *Non-Destructive Overwrite* (data lengkap dari `XXCUST` seperti No SO, nama cabang apotek spesifik, dan rincian item dilarang ditimpa oleh nilai `-` atau nama induk generik) dan *Zero SO Stripping* (dilarang mengosongkan/membuang No SO pada transaksi ORA/export).
   - Wajib mempertahankan validasi ketat file `XXCUST` resmi dan *Mismatch Rejection* antar gudang (`MBI LE` vs `MAI LE`).

4. **DILARANG KERAS Memotong atau Mengabaikan Data Report QC & Catatan Barang (Mandat Laptop 2)**:
   - Wajib membaca 100% data arsip DO Checker Firebase RTDB (`/archive.json`) secara utuh tanpa `slice` atau filter key parsial.
   - Dilarang keras menyembunyikan catatan kendala barang (Perubahan Batch, Qty Minus, Takeout, Tanpa Shipment). Setiap SO yang memiliki catatan di DO Checker wajib transparan menampilkan `⚠️ X Catatan` dan rincian itemnya dapat dilihat langsung di tab Catatan Barang.
   - Segala bentuk kendala jaringan atau kegagalan fetch wajib ditampilkan secara transparan kepada pengguna (*zero silent failures*).

5. **DILARANG KERAS Mengurangi Hitungan Kartu Report QC (Mandat Menunggu Faktur)**:
   - Kartu `REPORT QC` di header dan antrean aktif wajib 100% menghitung dan menampilkan seluruh SO yang belum memiliki No Invoice di Oracle (`!is_invoiced`).
   - Dilarang keras mengurangi hitungan atau mengeluarkan SO dari antrean hanya karena admin telah menandai `✓ DONE` pada SO tersebut. SO hanya boleh keluar dari hitungan jika fakturnya sudah terbit di Oracle.

6. **Kewajiban Saat Perbaikan, Optimasi Performa, atau Fitur Baru**:
   - Selalu baca [`LOCKED_RULES.md`](./LOCKED_RULES.md) sebelum merancang atau menulis perubahan kode pada `lib/parser.ts`, `app/page.tsx`, `lib/firestoreService.ts`, maupun `app/api/tidb/route.ts`.
   - Segala bentuk perubahan terhadap aturan di atas **DILARANG KERAS** dilakukan tanpa izin eksplisit dari pengguna.
