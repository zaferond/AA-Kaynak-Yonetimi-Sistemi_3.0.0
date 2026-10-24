# Test ve Kalite Raporu: 24.10.2026 (güncellendi)

Kapsam: tüm proje. İlk inceleme `f02e381` ve o andaki commit edilmemiş değişiklikler üzerinde yapıldı. Bu güncelleme `a0c3a9f` commit'inde yeniden doğrulandı ("Aktivite Raporu kapsamı görev kuralına bağlandı").
İnceleyenler: kalite mühendisi (salt okunur kod analizi) ve test mühendisi (doğrulama zinciri).

**Güncel durum:** Doğrulama zinciri tamamen yeşil. Üç bulgudan ikisi kapandı. Açık kalan tek madde düşük önemde (bulgu 2).

## Doğrulama zinciri

| Adım | İlk sonuç (`f02e381`) | Güncel sonuç (`a0c3a9f`) |
|---|---|---|
| iCloud kopya dosyaları | ✅ Yok | ✅ Yok |
| `npm run format:check` | ❌ 2 dosya Prettier biçiminde değil | ✅ Tüm dosyalar uygun |
| `npm run typecheck` | ✅ Geçti | ✅ Geçti |
| `npm test` | ❌ 1009 testin 1007'si geçti, 2'si kaldı | ✅ 1013 testin 1013'ü geçti |
| `npm run build` + `npm run deploy:verify` | ✅ `"ok": true` | ✅ `"ok": true` |
| `npm run test:ui`, `npm run test:db` | ⏭️ Çalıştırılmadı | ⏭️ Çalıştırılmadı (25 dakikalık tarayıcı paketi ve MSSQL ortamı) |

## Bulgular

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | Team Member Aktivite Raporu'nda takım arkadaşlarını görmüyor | Karar gerekli | ✅ Kapandı |
| 2 | Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor | Düşük | ⚠️ Açık |
| 3 | Biçim borcu (2 dosya) | Düşük | ✅ Kapandı |

### 1. ✅ [Kapandı] Aktivite Raporu'nda takım arkadaşlarının görünürlüğü

- **Karar:** Üye, raporda kendi takımını görür (rapor salt okunur). Aktivite Giriş'teki yazma kuralı değişmedi: Team Member orada yalnızca kendini görüyor.
- **Uygulama:** `shared/actual-entry-access.ts:103-127` içindeki `activityReportScope`. `includes` artık `scope.ownTeamId` ekibini de kapsıyor.
- **Testler:** `tests/activity-report.test.mjs` ve `tests/record-access-http.test.mjs` yeni kurala göre güncellendi, ikisi de yeşil. Tarayıcı kontrolü `scripts/browser-checks/activity-report.mjs` de güncellendi (bu turda çalıştırılmadı).
- **Hâlâ kontrol edilmeli:** `user.leaders` ile atanmış ama organizasyonda Lider olmayan `manager` hesapları, kaynak kaydı yoksa raporu boş görebilir. Bu durum kılavuzun 3.1 sürümünde belirtilmeli.

### 2. ⚠️ [Düşük, açık] Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor

- **Yer:** `backend/actual-report-reader.mjs:30,44` ve `backend/activity-report.mjs:57-59`, çağıran yer `backend/store.mjs:229-242`
- **Sorun:** `readActualReportData`, kapsamı `currentPlanningDate()` ile hesaplıyor. Ardından `activityReport` aynı kapsamı `currentPlanningMonth()` ile yeniden hesaplıyor. `store.activityReport` iki fonksiyona da ortak bir tarih geçirmiyor.
- **Senaryo:** İstek ay geçişine denk gelirse, ekip değiştiren ya da işe yeni başlayan bir kişi rapordan düşebilir. Sonuç iki kümenin kesişimi olduğu için veri sızmıyor, yalnızca satır eksik çıkıyor.
- **Düzeltme yönü:** Tarih `store.activityReport` içinde bir kez üretilsin ve iki fonksiyona da aynı değer geçirilsin.
- **Test önerisi:** `tests/actual-entry-access.test.mjs` dosyasına ay sınırında (`2026-10-31` / `2026-11`) başlayan bir kişi için tutarlılık testi eklenebilir.

### 3. ✅ [Kapandı] Biçim borcu

- `scripts/browser-checks/milestone-report-menu.mjs` ve `scripts/browser-checks/notifications.mjs` `a0c3a9f` commit'inde biçimlendirildi. `format:check` temiz.

## Şüpheli / bilgi

- **Kapsam ile satır ekipleri arasındaki zaman farkı:** Kişiler içinde bulunulan ayın görevlendirmesine göre seçiliyor, satırlar ise geçmiş ekiplere göre üretiliyor (`shared/activity-report.ts:65-73`). Bu yüzden bir PO, ekibine sonradan geçen birinin önceki aylarını göremiyor. Veri sızmıyor; davranış değişiklikten önce de böyleydi.

## Temiz çıkan kontroller

- 001–045 migrasyonlarının hepsinde hem `_sqljs.sql` hem `_mssql.sql` dosyası var. 3 ve 12 iki tarafta da yok; bu, `backend/migration-catalog.mjs` ile tutarlı. `MIGRATIONS.md` de 45'e kadar güncel.
- Kaldırılan `activityTeamScope` başka hiçbir yerde kullanılmıyor.
- Ön yüz kapsamı kendisi hesaplamıyor, sunucunun döndürdüğünü kullanıyor. Kural `shared/` içinde tek yerde.

## İyileştirme önerileri

- `readActualReportData` için geçmiş ay ve `date` parametresiyle çalışan bir HTTP testi eklenmeli.
- `activityReportResources` içindeki `teamIds.has(...)` kontrolünün neden gerektiğini açıklayan bir yorum satırı eklenebilir.
- Ön yüz değişikliklerini (`PasswordChangeForm.tsx`, Aktivite Raporu) doğrulamak için `npm run test:ui` çalıştırılmalı.

## Notlar

- Güncelleme sırasında kaynak koda, `data/planlama.sqlite` veritabanına, 3000/3001 portlarındaki sunuculara ve git'e dokunulmadı. Yalnızca bu rapor güncellendi.
