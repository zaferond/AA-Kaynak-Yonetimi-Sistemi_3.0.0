# Test ve Kalite Raporu: 24.10.2026 (güncellendi)

Kapsam: tüm proje. İlk inceleme `f02e381` ve o andaki commit edilmemiş değişiklikler üzerinde yapıldı. İkinci inceleme `a0c3a9f` commit'inde yeniden doğrulandı ("Aktivite Raporu kapsamı görev kuralına bağlandı"). Son doğrulama `b0cb93b` tabanı üzerindeki henüz commit edilmemiş tarih tutarlılığı, test ve Ana Sayfa sadeleştirme değişiklikleriyle yapıldı.
İlk inceleyenler: kalite mühendisi (salt okunur kod analizi) ve test mühendisi (doğrulama zinciri). Son güncelleme uygulama ve doğrulama sonuçlarını da içerir.

**Güncel durum:** Üç bulgu da kapandı. `npm run verify` ve `npm run deploy:verify` başarılı; 1015 testin tamamı geçti. Tam tarayıcı paketi ve native MSSQL testleri henüz çalıştırılmadı. Yönetici hesapları için kılavuz notu ve geçmiş takım görünürlüğü değerlendirmesi aşağıda takip işi olarak duruyor.

## Doğrulama zinciri

| Adım | İlk sonuç (`f02e381`) | Önceki sonuç (`a0c3a9f`) | Son sonuç (`b0cb93b` + çalışma ağacı) |
|---|---|---|---|
| iCloud kopya dosyaları | ✅ Yok | ✅ Yok | Bu turda ayrıca taranmadı |
| `npm run format:check` | ❌ 2 dosya Prettier biçiminde değil | ✅ Tüm dosyalar uygun | ✅ Geçti (`verify`) |
| `npm run typecheck` | ✅ Geçti | ✅ Geçti | ✅ Geçti (`build` içinde) |
| `npm test` | ❌ 1009 testin 1007'si geçti, 2'si kaldı | ✅ 1013/1013 | ✅ 1015/1015; başarısız/atlanan yok |
| `npm run build` + `npm run deploy:verify` | ✅ `"ok": true` | ✅ `"ok": true` | ✅ Derleme başarılı, `"ok": true`; kaynak ve çıktı farkı yok |
| Ana Sayfa hedefli tarayıcı kontrolü | — | — | ✅ Admin ve normal kullanıcı: kart açıklamaları kaldırılmış, Projeler kartı açılıyor; JavaScript hatası yok |
| `npm run test:ui`, `npm run test:db` | ⏭️ Çalıştırılmadı | ⏭️ Çalıştırılmadı | ⏭️ Çalıştırılmadı; hedefli kontrol tam UI paketi yerine geçmez |

## Bulgular

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | Team Member Aktivite Raporu'nda takım arkadaşlarını görmüyor | Karar gerekli | ✅ Kapandı |
| 2 | Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor | Düşük | ✅ Kapandı |
| 3 | Biçim borcu (2 dosya) | Düşük | ✅ Kapandı |

### 1. ✅ [Kapandı] Aktivite Raporu'nda takım arkadaşlarının görünürlüğü

- **Karar:** Üye, raporda kendi takımını görür (rapor salt okunur). Aktivite Giriş'teki yazma kuralı değişmedi: Team Member orada yalnızca kendini görüyor.
- **Uygulama:** `shared/actual-entry-access.ts:103-127` içindeki `activityReportScope`. `includes` artık `scope.ownTeamId` ekibini de kapsıyor.
- **Testler:** `tests/activity-report.test.mjs` ve `tests/record-access-http.test.mjs` yeni kurala göre güncellendi, ikisi de yeşil. Tarayıcı kontrolü `scripts/browser-checks/activity-report.mjs` de güncellendi (bu turda çalıştırılmadı).
- **Hâlâ kontrol edilmeli:** `user.leaders` ile atanmış ama organizasyonda Lider olmayan `manager` hesapları, kaynak kaydı yoksa raporu boş görebilir. Bu durum kılavuzun 3.1 sürümünde belirtilmeli.

### 2. ✅ [Kapandı] Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor

- **Yer:** `backend/store.mjs` → `readActualReportData` (`backend/actual-report-reader.mjs`) → `activityReport` (`backend/activity-report.mjs`).
- **Önceki sorun:** Veri okuma ve nihai rapor üretimi referans tarihini ayrı ayrı belirliyordu. Ay geçişinde iki kapsamın kesişimi nedeniyle satırlar eksilebiliyordu; veri sızıntısı gözlenmemişti.
- **Düzeltme:** `Store.activityReport`, `currentPlanningDate()` ile tarihi bir kez üretip okuyucuya aynı günü, rapor üretimine aynı gün ve bu günden türetilen ayı geçiriyor. `activityReport` bu günü `activityReportScope` hesabına iletiyor.
- **Birim regresyonu:** `tests/actual-entry-access.test.mjs` içinde saat kasıma geçmişken açıkça verilen `2026-10-31` tarihinin korunması, o gün işe başlayan kişi ve kasımda takım değiştiren kişi üzerinden doğrulanıyor. Kasım kapsamının yeni takımı seçtiği ve diğer takımın görünmediği de kontrol ediliyor.
- **HTTP regresyonu:** `tests/record-access-http.test.mjs` içinde SQL okuması sırasında İstanbul saatiyle `31.10.2026 23:59:59` → `01.11.2026 00:00:01` geçişi simüle ediliyor. Ocak–şubat geçmiş dönem sorgusu ve ekim–kasım sorgusunda kişiler, takım, kayıtlı tutarlar ve gelecek ay durumu doğrulanıyor. İstemciden yeni bir `date` sorgu parametresi alınmıyor; okuyucuya verilen ortak tarih sunucuda belirleniyor.
- **Sonuç:** Her iki yeni test hedefli koşuda ve 1015 testlik tam pakette geçti.

### 3. ✅ [Kapandı] Biçim borcu

- `scripts/browser-checks/milestone-report-menu.mjs` ve `scripts/browser-checks/notifications.mjs` `a0c3a9f` commit'inde biçimlendirildi. `format:check` temiz.

## Şüpheli / bilgi

- **Kapsam ile satır ekipleri arasındaki zaman farkı:** Kişiler içinde bulunulan ayın görevlendirmesine göre seçiliyor, satırlar ise geçmiş ekiplere göre üretiliyor (`shared/activity-report.ts:65-73`). Bu yüzden bir PO, ekibine sonradan geçen birinin önceki aylarını göremiyor. Veri sızmıyor; davranış değişiklikten önce de böyleydi.

## Temiz çıkan kontroller

- 001–045 migrasyonlarının hepsinde hem `_sqljs.sql` hem `_mssql.sql` dosyası var. 3 ve 12 iki tarafta da yok; bu, `backend/migration-catalog.mjs` ile tutarlı. `MIGRATIONS.md` de 45'e kadar güncel.
- Kaldırılan `activityTeamScope` başka hiçbir yerde kullanılmıyor.
- Ön yüz kapsamı kendisi hesaplamıyor, sunucunun döndürdüğünü kullanıyor. Kural `shared/` içinde tek yerde.

## Tamamlanan iyileştirmeler

- Geçmiş dönem ve ortak referans tarihini kapsayan HTTP testi eklendi.
- `activityReportResources` içindeki `teamIds.has(...)` kontrolünün, kişinin kendisini kapsayan `includes()` koşuluna ek olarak atanmış takımın da görünür kapsamda olmasını gerektirdiği yorumla açıklandı.
- Ana Sayfa (İçindekiler) kartlarının başlık altı detay açıklamaları ve kullanılmayan `.home-card-text` stili kaldırıldı. Başlıklar ve ekranı açma davranışı korundu; Admin ve normal kullanıcıyla hedefli tarayıcı kontrolü geçti.
- `npm run verify` ve `npm run deploy:verify` çalıştırıldı; dağıtım manifesti derleme tarafından yenilendi.

## Kalan takip işleri

- `user.leaders` ataması ile organizasyondaki Lider görevi arasındaki fark ve kaynak kaydı olmayan `manager` hesaplarının boş rapor görmesi kılavuz 3.1'de açıklanmalı. Manuel README'sindeki 3.0 sürüm bilgisi, HTML'deki 3.1 ile eşitlenmeli.
- Ön yüz değişikliklerini (`PasswordChangeForm.tsx`, Aktivite Raporu) doğrulamak için tam `npm run test:ui` paketi çalıştırılmalı.
- Uygun MSSQL test ortamında `npm run test:db` çalıştırılmalı.
- Geçmiş takım aylarının görünürlüğü için yukarıdaki mevcut davranış değerlendirilmeli; farklı davranış istenirse ayrı kapsam/yetki değişikliği olarak ele alınmalı.

## Notlar

- Önceki rapor güncellemesi salt okunur incelemeydi. Bu son turda kaynak kod, testler, Ana Sayfa ve dağıtım manifesti güncellendi.
- Testler geçici sentetik SQL.js veritabanları ve rastgele yerel portlarla çalıştı; `data/planlama.sqlite` ve 3000/3001 portlarındaki sunucular kullanılmadı.
- Bu turda commit/push yapılmadı. Doğrulanan durum `b0cb93b` tabanı ve yukarıdaki çalışma ağacı değişiklikleridir; manifestteki commit alanı taban commit'i gösterir.
