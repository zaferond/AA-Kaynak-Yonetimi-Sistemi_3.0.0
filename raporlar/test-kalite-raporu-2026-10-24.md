# Test ve Kalite Raporu: 24.10.2026 (güncellendi)

Kapsam: tüm proje. İlk inceleme `f02e381` ve o andaki commit edilmemiş değişiklikler üzerinde yapıldı. İkinci inceleme `a0c3a9f` commit'inde yeniden doğrulandı ("Aktivite Raporu kapsamı görev kuralına bağlandı"). Tarih tutarlılığı, test ve Ana Sayfa sadeleştirme değişiklikleri doğrulandı ve `fc8933a` commit'iyle `main` dalından GitHub'a gönderildi. Son belge güncellemesi, kullanıcı manueli 3.1 ve kesinleşen aktivite yetki kararını içerir.
İlk inceleyenler: kalite mühendisi (salt okunur kod analizi) ve test mühendisi (doğrulama zinciri). Son güncelleme uygulama ve doğrulama sonuçlarını da içerir.

**Güncel durum:** Üç bulgu da kapandı. `npm run verify` ve `npm run deploy:verify` başarılı; 1015 testin tamamı geçti. Yönetici/çalışan görevi ayrımı kesinleştirildi ve kılavuz 3.1'e işlendi. Bu rapordaki açık geliştirme bulgusu kalmadı; tam UI ve native MSSQL doğrulaması ile geçmiş takım aylarının görünürlüğüne ilişkin isteğe bağlı ürün değerlendirmesi kaldı.

## Doğrulama zinciri

| Adım | İlk sonuç (`f02e381`) | Önceki sonuç (`a0c3a9f`) | Son sonuç (`fc8933a`; belge güncellemesi ayrıca) |
|---|---|---|---|
| iCloud kopya dosyaları | ✅ Yok | ✅ Yok | Bu turda ayrıca taranmadı |
| `npm run format:check` | ❌ 2 dosya Prettier biçiminde değil | ✅ Tüm dosyalar uygun | ✅ Geçti (`verify`) |
| `npm run typecheck` | ✅ Geçti | ✅ Geçti | ✅ Geçti (`build` içinde) |
| `npm test` | ❌ 1009 testin 1007'si geçti, 2'si kaldı | ✅ 1013/1013 | ✅ 1015/1015; başarısız/atlanan yok |
| `npm run build` + `npm run deploy:verify` | ✅ `"ok": true` | ✅ `"ok": true` | ✅ Derleme başarılı, `"ok": true`; kaynak ve çıktı farkı yok |
| Ana Sayfa hedefli tarayıcı kontrolü | — | — | ✅ Admin ve normal kullanıcı: kart açıklamaları kaldırılmış, Projeler kartı açılıyor; JavaScript hatası yok |
| Manuel 3.1 PDF kontrolü | — | — | ✅ 23 sayfa; metin, sürüm, kaldırılan kapak satırları ve sayfa sınırları kontrol edildi; tüm sayfalar görsel incelendi |
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
- **Kesinleşen karar:** Yönetici (`manager`) uygulama rolü aktivite ekranlarının erişimini belirler; kişi kapsamını genişletmez. `user.leaders` planlama yetkisi içindir. Admin dışındaki hesaplarda Aktivite Giriş ve Aktivite Raporu kapsamı hesaba bağlı çalışanın görevinden gelir. Çalışan kaydıyla eşleşmemiş Yönetici hesabının boş sonuç görmesi beklenen davranıştır. Kılavuz 3.1'de açıklandı.

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
- Kullanıcı manueli HTML/PDF ve README sürüm 3.1'de eşitlendi. Yönetici ile organizasyondaki Lider ayrımı, hesap-çalışan eşleşmesi gerekliliği ve Admin istisnası belgelendi; Aktivite Raporu'nun yetki matrisi düzeltildi.
- Manuelin kapak tablosundan Uygulama durumu, Önceki sürüme göre ve Ekran görüntüleri satırları kaldırıldı. Ana Sayfa görseli güncellendi; 23 sayfalık PDF yeniden üretilip doğrulandı.

## Kalan takip işleri

| İş | Tür | Tamamlanma ölçütü |
|---|---|---|
| Tam `npm run test:ui` paketini çalıştır | Doğrulama | Şifre değiştirme, Aktivite Giriş/Raporu ve diğer tarayıcı senaryoları geçmeli; sonuç rapora eklenmeli. Hedefli Ana Sayfa kontrolü bu paketin yerine geçmez. |
| Uygun MSSQL ortamında `npm run test:db` çalıştır | Ortam bağımlı doğrulama | Native MSSQL testleri geçmeli; kullanılan ortam ve sonuç kaydedilmeli. SQL.js testlerinin başarılı olması native MSSQL kabulü değildir. |
| Geçmiş takım aylarının görünürlüğünü değerlendir | İsteğe bağlı ürün kararı | Mevcut davranış kabul edilirse ek geliştirme gerekmez. Farklı görünürlük istenirse kapsam, erişim kuralı ve regresyon senaryoları ayrı iş olarak tanımlanmalı. Bu konu Yönetici/çalışan görevi kararından ayrıdır. |

## Notlar

- Kaynak kod, testler, Ana Sayfa ve dağıtım manifesti `fc8933a` ile `origin/main` dalına gönderildi. Bu son rapor güncellemesinde manuel HTML/PDF, README ve Ana Sayfa görseli de yenilendi.
- Testler geçici sentetik SQL.js veritabanları ve rastgele yerel portlarla çalıştı; `data/planlama.sqlite` ve 3000/3001 portlarındaki sunucular kullanılmadı.
- Uygulama doğrulaması tamamlandıktan sonra bu turda yalnız dokümantasyon ve manuel görseli değişti; tam test zinciri gereksiz yere tekrarlanmadı. PDF ayrıca doğrulandı. Manifestteki commit alanı derlemenin alındığı `b0cb93b` tabanını gösterir; uygulama kaynakları/derleme eşitliği `deploy:verify` ile denetlenir.
