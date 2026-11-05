---
trigger: always_on
description: Enforces 100% strict compliance with LOCKED_RULES.md on every fix, performance optimization, or new feature request.
---

# 🔒 MANDATORY PROJECT RULES (LOCKED_RULES.md ENFORCEMENT)

Setiap kali pengguna meminta perbaikan, optimasi performa, atau fitur baru pada proyek **Faktur Tracker (`fantastic-order`)**, kamu **WAJIB** membaca dan mematuhi seluruh aturan di [`LOCKED_RULES.md`](../../LOCKED_RULES.md) **100% tanpa pengecualian**.

## Larangan Mutlak Tanpa Izin Eksplisit
1. **DILARANG KERAS** mengubah logika kunci faktur:
   - Isolasi **DOO** (`${cleanInv}`) vs **ORA** (`${cleanInv}-1P`).
   - Isolasi **Gudang MBI** vs **Gudang MAI** (`MAI-${baseKey}`).
   - Isolasi **Key Komposit (`__`)** berbasis beda bulan (`order_date`) & beda No SO (`${baseTargetKey}__${cleanSO}`). Dilarang memecah faktur di bulan yang sama atau menebak berdasarkan rentang nomor faktur.
2. **DILARANG KERAS** mengubah logika **status cetak permanen** (`status_cetak: true` tidak boleh ter-reset saat upload/sinkronisasi, dan faktur baru wajib `Belum Terprint`).
3. **DILARANG KERAS** mengubah **cara pembacaan file upload** (wajib baca lengkap seluruh sheet/baris/kolom tanpa asumsi, pertahankan *Non-Destructive Overwrite*, *Zero SO Stripping*, dan *Mismatch Rejection* MBI vs MAI).
