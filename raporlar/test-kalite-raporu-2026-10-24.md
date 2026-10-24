# Test ve Kalite Raporu: 24.10.2026

Kapsam: tüm proje, commit edilmemiş değişikliklere ayrıca odaklanıldı (son commit `f02e381`).
İnceleyenler: kalite mühendisi (salt okunur kod analizi) ve test mühendisi (doğrulama zinciri).

Kritik veya yüksek önemde, kanıtlanmış bir hata çıkmadı. Ancak zincir tam yeşil değil. Kalan iki test, bir ürün kararına bağlı.

## Doğrulama zinciri

| Adım | Sonuç | Süre |
|---|---|---|
| iCloud kopya dosyaları | ✅ Yok | <1 sn |
| `npm run format:check` | ❌ 2 dosya Prettier biçiminde değil | 15 sn |
| `npm run typecheck` | ✅ Geçti | 14 sn |
| `npm test` | ❌ 1009 testin 1007'si geçti, 2'si kaldı | 70 sn |
| `npm run build` + `npm run deploy:verify` | ✅ Geçti, `"ok": true` | 7 sn |
| `npm run test:ui`, `npm run test:db` | ⏭️ Çalıştırılmadı (25 dakikalık tarayıcı paketi ve MSSQL ortamı) | – |

## Bulgular

### 1. [Karar gerekli] Aktivite Raporu'nda bir Team Member artık takım arkadaşlarını görmüyor

- **Yer:** `shared/actual-entry-access.ts:103-124`, `backend/actual-report-reader.mjs:43-50`, `backend/activity-report.mjs:41-52`
- **Neden:** Bu sonuç commit edilmemiş değişiklikten geliyor. Eski kural (`activityTeamScope`) kaldırıldı. Aktivite Raporu artık Aktivite Giriş ile aynı kişileri gösteriyor.
- **Kırmızı testler:**
  - `tests/activity-report.test.mjs:271`: beklenen `{a, peer}`, gelen `{a}`.
  - `tests/record-access-http.test.mjs:2731`: beklenen `{activity-own, activity-peer, activity-manager}`, gelen `{activity-own}`.
- **Yan etki:** `user.leaders` ile atanmış ama organizasyonda Lider olmayan `manager` hesapları raporu boş görebilir.
- **Karar:**
  - Bu bilinçli bir kararsa iki test eskimiş demektir ve yeni kurala göre güncellenmeli. Kılavuzun 3.1 sürümüne de bir not eklenmeli.
  - Karar bu değilse testler gerçek bir yetki daralmasını yakalıyor ve kodun düzeltilmesi gerekiyor.
- **Yeniden üretim:** `node --test tests/activity-report.test.mjs tests/record-access-http.test.mjs`

### 2. [Düşük] Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor

- **Yer:** `backend/actual-report-reader.mjs:44` ve `backend/activity-report.mjs:59`, çağıran yer `backend/store.mjs:232-239`
- **Sorun:** `readActualReportData`, kapsamı `currentPlanningDate()` ile hesaplıyor. Ardından `activityReport` aynı kapsamı `currentPlanningMonth()` ile yeniden hesaplıyor.
- **Senaryo:** İstek ay geçişine denk gelirse, ekip değiştiren ya da işe yeni başlayan bir kişi rapordan düşebilir. Sonuç iki kümenin kesişimi olduğu için veri sızmıyor, yalnızca satır eksik çıkıyor.
- **Düzeltme yönü:** Tarih `store.activityReport` içinde bir kez üretilsin ve iki fonksiyona da aynı değer geçirilsin.
- **Test önerisi:** `tests/actual-entry-access.test.mjs` dosyasına ay sınırında (`2026-10-31` / `2026-11`) başlayan bir kişi için tutarlılık testi eklenebilir.

### 3. [Düşük] Biçim borcu

- **Yer:** `scripts/browser-checks/milestone-report-menu.mjs`, `scripts/browser-checks/notifications.mjs`
- **Sorun:** İki dosya Prettier biçiminde değil. İkisi de daha önce commit edilmiş dosyalar; güncel değişiklikle ilgisi yok.
- **Düzeltme:** `npx prettier --write` bu iki dosyaya uygulanır.

## Şüpheli / bilgi

- **Kapsam ile satır ekipleri arasındaki zaman farkı:** Kişiler içinde bulunulan ayın görevlendirmesine göre seçiliyor, satırlar ise geçmiş ekiplere göre üretiliyor (`shared/activity-report.ts:65-73`). Bu yüzden bir PO, ekibine sonradan geçen birinin önceki aylarını göremiyor. Veri sızmıyor; davranış değişiklikten önce de böyleydi.

## Temiz çıkan kontroller

- 001–045 migrasyonlarının hepsinde hem `_sqljs.sql` hem `_mssql.sql` dosyası var. 3 ve 12 iki tarafta da yok; bu, `backend/migration-catalog.mjs` ile tutarlı. `MIGRATIONS.md` de 45'e kadar güncel.
- Kaldırılan `activityTeamScope` başka hiçbir yerde kullanılmıyor.
- Ön yüz kapsamı kendisi hesaplamıyor, sunucunun döndürdüğünü kullanıyor. Kural `shared/` içinde tek yerde.
- `tests/actual-entry-access.test.mjs` içindeki 7 testin hepsi geçti.

## İyileştirme önerileri

- `readActualReportData` için geçmiş ay ve `date` parametresiyle çalışan bir HTTP testi eklenmeli.
- `activityReportResources` içindeki `teamIds.has(...)` kontrolünün neden gerektiğini açıklayan bir yorum satırı eklenebilir.

## Notlar

- Kaynak koda, `data/planlama.sqlite` veritabanına, 3000/3001 portlarındaki sunuculara ve git'e dokunulmadı. Yeni test eklenmedi.
