# Grand Strategy Simulation Engine (GSG Core)

[![Simulation CI](https://github.com/mert-can-baybekman/tactic-map-game/actions/workflows/simulation-ci.yml/badge.svg)](https://github.com/mert-can-baybekman/tactic-map-game/actions/workflows/simulation-ci.yml)
[![Deploy Game to GitHub Pages](https://github.com/mert-can-baybekman/tactic-map-game/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/mert-can-baybekman/tactic-map-game/actions/workflows/deploy-pages.yml)

> ### 🎮 **[OYUNU CANLI OYNA / PLAY LIVE ON GITHUB PAGES](https://mert-can-baybekman.github.io/tactic-map-game/)**  
> ### ⚙️ **[GITHUB ACTIONS SİMÜLASYON LOGLARI / VIEW CI RUNS](https://github.com/mert-can-baybekman/tactic-map-game/actions)**

---

## GitHub Üzerinde Nasıl Görünür ve Çalıştırılır?

1. **Canlı İnteraktif Harita ve Simülasyon Arayüzü (GitHub Pages):**
   - Doğrudan tarayıcınızda oynamak için: **[https://mert-can-baybekman.github.io/tactic-map-game/](https://mert-can-baybekman.github.io/tactic-map-game/)** bağlantısına tıklayın.
   - İnteraktif eyalet haritası (Londra, Dover, Calais, Rouen, Paris).
   - Gerçek zamanlı tick kontrolleri (Play / Pause, Günlük ve Aylık adım, hız ayarı).
   - Nüfus ve mikro-pop demografisi, Veba salgını tetikleme, derebeylik ordusu toplama.
   - Pakt ve ayrıcalık yönetimi (Privileges), vergi kaçırma akışları (Tax Skimming).
   - Manş Denizi ablukası (Blockade) ve silah atölyesi çöküş simülatörü.
   - 2 sıralı ve kanat sarmalı (flanking) taktiksel savaş matrisi.

2. **GitHub Actions Üzerindeki Motor Simülasyonu:**
   - GitHub deposunun üst menüsündeki **`Actions`** sekmesine tıklayın ([veya buraya tıklayın](https://github.com/mert-can-baybekman/tactic-map-game/actions)).
   - En son çalışan iş akışını (Workflow Run) seçin.
   - `Simulation & Economic Integrity Pipeline` job'una tıklayarak terminal simülasyon çıktılarını, 90 günlük takas döngülerini, savaş sonuçlarını ve stres testlerini canlı olarak inceleyin.

---

## Temel Sistemler ve Mimari (Clausewitz / Project Caesar İlhamlı)

1. **Mikro-Demografik Pop Motoru:**
   - Sosyal tabakalara (Soylular, Ruhban, Burjuva, Avam, Aşiretler) ayrılmış alt-eyalet nüfus birimleri.
   - Doğum/Ölüm formülü: $\text{Büyüme} = \text{Temel Oran} \times \text{Temel İhtiyaç} - (\text{Yıkım} \times 0.1)$.
   - Yıkım > %40 veya bölgesel fakirlikte güvenli eyaletlere organik göç vektörleri.
   - Kara Ölüm (Veba) yayılma simülatörü.

2. **Mana Olmayan (Non-Mana) Devlet Yönetimi ve Eyalet Kontrolü:**
   - Soyut hükümdar puanları (Admin/Diplo/Mil) tamamen kaldırılmıştır. Tüm harcamalar altın (Dukat), takvim tickleri, lojistik erzak ve Taç Gücü (Crown Power) ile yapılır.
   - Başkentten uzaklığa bağlı üstel kontrol kaybı: $\text{Kontrol} = 1.0 \times e^{-\text{Decay} \times \text{Lojistik Mesafe}}$. Limanlar deniz koridorlarıyla mesafeyi %75 oranında sıkıştırır.
   - Toplanamayan vergiler silinmez; yerel Soylu ve Burjuva kasalarına aktarılarak isyanlarını finanse eder.

3. **Yönlendirilmiş Ticaret Grafı ve Pazar Takas Döngüsü:**
   - Statik ticaret düğümleri yerine yönlü ticaret koridorları.
   - Fiyat esnekliği formülü: $\text{Fiyat} = \text{Taban Fiyat} \times (\frac{\text{Talep}}{\text{Arz}})^{\text{Esneklik}}$.
   - Değer zinciri: Madenler (Demir/Kereste) $\to$ Atölyeler (Silah/Zırh/Top). Ablukada girdi kesildiğinde silah üretimi %0'a çakılır.

4. **Feodal Asker Toplama ve Taktik Savaş Matrisi:**
   - Askerler doğrudan Pop havuzundan seferber edilir (%5 Soylu $\to$ Ağır Süvari, %8 Avam $\to$ Piyade).
   - Savaşta ölen askerler köken eyaletteki nüfustan kalıcı olarak eksilir.
   - Ön sıra, arka sıra bombardımanı ve kanat sarmalı süvari manevraları.

---

## Yerel Kurulum ve Testler

```bash
# Testleri çalıştır
npm test

# Terminal simülasyonunu çalıştır
npm run simulate
```