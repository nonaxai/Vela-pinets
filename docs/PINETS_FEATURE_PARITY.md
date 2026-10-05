# Analisis Fitur: PineTS vs Vela-pinets

Dokumen ini mencatat pemetaan fitur, status integrasi, dan perbandingan kemampuan antara **[PineTS](https://github.com/LuxAlgo/PineTS)** (runtime & transpiler Pine Script) dan **`@luxalgo/vela-pinets`** (addon execution engine untuk Vela).

---

## 1. Perbedaan Peran & Arsitektur

- **PineTS (`pinets`)**: Runtime & transpiler mandiri untuk mengeksekusi TradingView Pine Script® v5/v6 di berbagai lingkungan JavaScript (Node.js, browser, server). PineTS mengelola evaluasi bar demi bar, kalkulasi time-series, broker emulator strategi, dan namespace bawaan Pine Script.
- **Vela-pinets (`@luxalgo/vela-pinets`)**: Adaptor penghubung yang mengimplementasikan port publik `ScriptingEngine` milik Vela. Vela-pinets mengambil kode Pine Script, menjalankannya melalui PineTS (baik *in-process* maupun di Web Worker), dan mengonversi outputnya menjadi format visual netral (`IndicatorModel`) yang dirender oleh Vela.

---

## 2. Fitur PineTS yang Belum Ditambahkan / Belum Diekspos di Vela-pinets

### A. Metrik Risiko & Performa Strategi Lanjutan (*Advanced Strategy Metrics*)
PineTS (terutama pada pembaruan v0.9.19 s.d. v0.9.27) telah menambahkan banyak metrik statistik performa di objek `context.strategy`:
- **`sharpe_ratio` & `sortino_ratio`**: Rasio imbal hasil risiko bulanan sesuai standar formula TradingView.
- **`cagr`**: *Compound Annual Growth Rate* (%) dari ekuitas strategi selama periode backtest.
- **`buy_and_hold_pnl` & `buy_and_hold_per_gain`**: Benchmark performa *Buy & Hold* (keuntungan jika membeli di awal dan menahan hingga akhir).
- **`strategy_outperformance`**: Selisih keuntungan strategi terhadap benchmark Buy & Hold (`netprofit - buy_and_hold_pnl`).
- **`max_drawdown_percent` & `max_runup_percent`**: Drawdown dan runup historis dalam persentase ekuitas pada saat latch.
- **`margin_liquidation_price`**: Estimasi harga likuidasi akun saat menggunakan leverage margin.
- **`risk_free_rate`**: Opsi deklarasi strategi untuk suku bunga bebas risiko tahunan (default 2%).

> **Status di `vela-pinets`**:
> Di `src/pinets/strategyState.ts`, fungsi `toStrategyState()` saat ini baru mengekstrak metrik dasar: `position`, `avgPrice`, `equity`, `openPnl`, `netPnl`, `grossProfit`, `grossLoss`, `wins`, `losses`, `even`, `maxDrawdown`, `maxRunup`, dan `initialCapital`. Metrik-metrik Sharpe, Sortino, CAGR, dan Buy & Hold dari PineTS belum dipetakan ke model context snapshot Vela.

---

### B. Sintaks Indikator Berbasis JavaScript Callback (`PineTS Syntax`)
PineTS mendukung dua gaya penulisan skrip:
1. **Native Pine Script**: String kode Pine (`//@version=5\nindicator(...)`).
2. **PineTS Syntax (JS/TS Function)**: Logika indikator ditulis langsung sebagai fungsi callback JS/TS:
   ```ts
   pineTS.run(($) => {
       const { close } = $.data;
       const { ta, plot } = $.pine;
       plot(ta.ema(close, 20), 'EMA 20');
   });
   ```

> **Status di `vela-pinets`**:
> `vela-pinets` hanya mengekspos eksekusi berbasis string Pine Script melalui `prepare(source: string)`. Dukungan eksekusi fungsi callback JS/TS belum dibuka melalui `ScriptingEngine`.

---

### C. Provider Data Bawaan PineTS (Alpaca, FMP, Mock)
PineTS menyertakan client HTTP market data di `src/marketData/`:
- **Alpaca** (`Provider.Alpaca`)
- **FMP** (`Provider.FMP` — Financial Modeling Prep)
- **Mock Provider**

> **Status di `vela-pinets`**:
> Provider bawaan PineTS tidak digunakan. Sesuai prinsip Vela (*"Core owns market data"*), vela-pinets menggunakan bar in-memory yang diberikan oleh Vela, dan pemanggilan sekunder (`request.security`) dialihkan ke `fetchSeries` milik Vela.

---

### D. Logging Pine Script (`log.*` Namespace)
PineTS mengimplementasikan namespace `log` (`log.info()`, `log.warning()`, `log.error()`) dengan format template `{0}` dan timezone.

> **Status di `vela-pinets`**:
> Di PineTS, `log.*` langsung menulis ke `console.log`. `vela-pinets` belum menangkap stream log ini ke dalam struktur event `ExecutionHandlers` (hanya menangkap `onAlert` dan `onWarning`). Jika dijalankan di Web Worker, log tersebut tidak sampai ke UI host secara terstruktur.

---

### E. Integrasi Tema Warna Chart (`chart.bg_color` & `chart.fg_color`)
Di Pine Script, `chart.bg_color` dan `chart.fg_color` mengembalikan warna tema chart.

> **Status di `vela-pinets`**:
> Nilai ini di-hardcode di PineTS (`#1e293b` dan `#d1d4dc`). Walaupun `vela-pinets` sudah berhasil menyinkronkan viewport range (`chart.left_visible_bar_time` dan `right_visible_bar_time`), vela-pinets belum menyuntikkan warna tema dinamis Vela (misalnya saat pengguna berganti tema dark/light) ke objek konteks PineTS.

---

### F. Inspeksi Variabel Kompleks (Map, Matrix, UDT)
PineTS mendukung struktur data Pine v5:
- `map.*`
- `matrix.*`
- User-Defined Types (`type MyType ...`)

> **Status di `vela-pinets`**:
> Di `src/pinets/contextSnapshot.ts`, ekstraksi variabel hanya membaca bar terakhir dan melakukan `structuredClone()`. Belum ada representasi terformat khusus untuk `Map`, `Matrix`, atau objek UDT untuk inspeksi debugger UI.

---

## 3. Tambalan Khusus (*Patches*) di Vela-pinets

Ada dua area di mana `vela-pinets` menambal keterbatasan yang masih ada di PineTS:
1. **`tablePatch.ts`**: Menambahkan dukungan properti `text_formatting` (`bold`, `italic`) pada `table.cell()` dan setter `table.cell_set_text_formatting` yang belum ada di versi upstream PineTS.
2. **`markerPatch.ts`**: Menyintesis callsite ID stabil per bar untuk pemanggilan `plotshape()`, `plotchar()`, dan `plotarrow()` tanpa judul agar opsi plot tidak saling menimpa.

---

## 4. Tabel Ringkasan

| Fitur di PineTS | Status di `vela-pinets` | Dampak / Keterangan |
| :--- | :--- | :--- |
| **Metrik Risiko Strategi** (Sharpe, Sortino, CAGR, B&H) | Belum diekstrak | Tersedia di `ctx.strategy`, belum dimodelkan di `strategyState.ts` |
| **JS Function Callback** (`pineTS.run(($) => ...)`) | Belum diekspos | `vela-pinets` fokus pada parsing string Pine Script |
| **Provider Bawaan** (Alpaca, FMP) | Dilewati | Vela mengontrol penuh sumber data melalui `DataProvider` |
| **`log.*` Stream** | Belum ditangkap | Masuk ke console langsung, belum menjadi event terstruktur |
| **`chart.bg_color` / `chart.fg_color`** | Hardcoded | Belum mengikuti tema dinamis Vela |
| **Table Formatting & Marker Callsites** | Ditambal oleh vela-pinets | Patch runtime aktif di `tablePatch.ts` & `markerPatch.ts` |
