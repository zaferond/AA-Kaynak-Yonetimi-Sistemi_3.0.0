# Test ve Kalite Raporu: 24.10.2026 (güncellendi)

**25.10.2026 güncellemesi:** Son güvenlik/CI düzeltmeleri ve güncel doğrulama sonuçları [düzeltme raporunda](duzeltme-ve-dogrulama-raporu-2026-10-25.md) yer alır. Aşağıdaki sonuçlar önceki sürümün kaydıdır.

Kapsam: tüm proje. İlk inceleme `f02e381` ve o andaki commit edilmemiş değişiklikler üzerinde yapıldı. İkinci inceleme `a0c3a9f` commit'inde yeniden doğrulandı ("Aktivite Raporu kapsamı görev kuralına bağlandı"). Tarih tutarlılığı, test ve Ana Sayfa sadeleştirme değişiklikleri doğrulandı ve `fc8933a` commit'iyle `main` dalından GitHub'a gönderildi. Takım geçmişi ve değerlendirme yüzdeleri düzeltmeleri `160f761` ile main dalına gönderildi. Son tur, bu commit tabanında giriş ekranındaki ay satırını ve Yöneticinin haftalık kritik konu düzenleme yetkisini ekler; bu son değişiklikler bu raporla aynı commit içinde main dalına alınmıştır.
İlk inceleyenler: kalite mühendisi (salt okunur kod analizi) ve test mühendisi (doğrulama zinciri). Son güncelleme uygulama ve doğrulama sonuçlarını da içerir.

**Güncel durum:** İlk üç bulgu kapalı. Sonradan incelenen takım geçmişi ve kaynak planı boşken değerlendirme yüzdelerinin görünmemesi de düzeltildi. `npm run verify` başarılı; 1022 testin tamamı geçti. `npm run deploy:verify` sonucu `"ok": true`. Aktivite Raporu ve Proje/Kaynak Değerlendirme hedefli tarayıcı kontrolleri başarılı. Ay seçimi durum filtrelerinin altına taşındı; Yöneticiye yalnız görünür projelerin kritik başlık/konu/tarih düzenlemesi açıldı. Tam UI paketi ve native MSSQL doğrulaması kaldı.

## Doğrulama zinciri

| Adım | İlk sonuç (`f02e381`) | Önceki sonuç (`a0c3a9f`) | Son sonuç (`160f761` üzerine bu raporla birlikte alınan değişiklikler) |
|---|---|---|---|
| iCloud kopya dosyaları | ✅ Yok | ✅ Yok | Bu turda ayrıca taranmadı |
| `npm run format:check` | ❌ 2 dosya Prettier biçiminde değil | ✅ Tüm dosyalar uygun | ✅ Geçti (`verify`) |
| `npm run typecheck` | ✅ Geçti | ✅ Geçti | ✅ Geçti (`build` içinde) |
| `npm test` | ❌ 1009 testin 1007'si geçti, 2'si kaldı | ✅ 1013/1013 | ✅ 1022/1022; başarısız/atlanan yok |
| `npm run build` + `npm run deploy:verify` | ✅ `"ok": true` | ✅ `"ok": true` | ✅ Derleme başarılı, `"ok": true`; kaynak ve çıktı farkı yok |
| Ana Sayfa hedefli tarayıcı kontrolü | — | — | ✅ Admin ve normal kullanıcı: kart açıklamaları kaldırılmış, Projeler kartı açılıyor; JavaScript hatası yok |
| Manuel 3.1 PDF kontrolü | — | — | ✅ 23 sayfa; metin, sürüm, kaldırılan kapak satırları ve sayfa sınırları kontrol edildi; tüm sayfalar görsel incelendi |
| Aktivite ve değerlendirme hedefli tarayıcı kontrolleri | — | — | ✅ Mevcut iki kontrol paketi; kendi takım geçmişi ve sıfır kaynaklı değerlendirme örnekleri ayrıca doğrulandı |
| `npm run test:ui`, `npm run test:db` | ⏭️ Çalıştırılmadı | ⏭️ Çalıştırılmadı | ⏭️ Çalıştırılmadı; hedefli kontrol tam UI paketi yerine geçmez |

## Bulgular

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | Team Member Aktivite Raporu'nda takım arkadaşlarını görmüyor | Karar gerekli | ✅ Kapandı |
| 2 | Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor | Düşük | ✅ Kapandı |
| 3 | Biçim borcu (2 dosya) | Düşük | ✅ Kapandı |
| 4 | Takım değiştiren kişinin eski takım ayları ve kendi geçmişi eksiliyor | Orta | ✅ Kapandı |
| 5 | Kaynak planı yokken kayıtlı hedef/gerçekleşen yüzdeleri görünmüyor | Orta | ✅ Kapandı |

### 1. ✅ [Kapandı] Aktivite Raporu'nda takım arkadaşlarının görünürlüğü

- **Karar:** Üye, raporda kendi takımını görür (rapor salt okunur). Aktivite Giriş'teki yazma kuralı değişmedi: Team Member orada yalnızca kendini görüyor.
- **Uygulama:** `shared/actual-entry-access.ts:103-127` içindeki `activityReportScope`. `includes` artık `scope.ownTeamId` ekibini de kapsıyor.
- **Testler:** `tests/activity-report.test.mjs` ve `tests/record-access-http.test.mjs` yeni kurala göre güncellendi, ikisi de yeşil. Tarayıcı kontrolü `scripts/browser-checks/activity-report.mjs` de son turda çalıştırıldı ve geçti.
- **Kesinleşen karar:** Yönetici (`manager`) uygulama rolü aktivite ekranlarının erişimini belirler; kişi kapsamını genişletmez. `user.leaders` planlama yetkisi içindir. Admin dışındaki hesaplarda Aktivite Giriş ve Aktivite Raporu kapsamı hesaba bağlı çalışanın görevinden gelir. Çalışan kaydıyla eşleşmemiş Yönetici hesabının boş sonuç görmesi beklenen davranıştır. Kılavuz 3.1'de açıklandı.

### 2. ✅ [Kapandı] Rapor kapsamı iki ayrı "bugün" değeriyle hesaplanıyor

- **Yer:** `backend/store.mjs` → `readActualReportData` (`backend/actual-report-reader.mjs`) → `activityReport` (`backend/activity-report.mjs`).
- **Önceki sorun:** Veri okuma ve nihai rapor üretimi referans tarihini ayrı ayrı belirliyordu. Ay geçişinde iki kapsamın kesişimi nedeniyle satırlar eksilebiliyordu; veri sızıntısı gözlenmemişti.
- **Düzeltme:** `Store.activityReport`, `currentPlanningDate()` ile tarihi bir kez üretip okuyucuya aynı günü, rapor üretimine aynı gün ve bu günden türetilen ayı geçiriyor. `activityReport` bu günü `activityReportScope` hesabına iletiyor.
- **Birim regresyonu:** `tests/actual-entry-access.test.mjs` içinde saat kasıma geçmişken açıkça verilen `2026-10-31` tarihinin korunması, o gün işe başlayan kişi ve kasımda takım değiştiren kişi üzerinden doğrulanıyor. Kasım kapsamının yeni takımı seçtiği ve diğer takımın görünmediği de kontrol ediliyor.
- **HTTP regresyonu:** `tests/record-access-http.test.mjs` içinde SQL okuması sırasında İstanbul saatiyle `31.10.2026 23:59:59` → `01.11.2026 00:00:01` geçişi simüle ediliyor. Ocak–şubat geçmiş dönem sorgusu ve ekim–kasım sorgusunda kişiler, takım, kayıtlı tutarlar ve gelecek ay durumu doğrulanıyor. İstemciden yeni bir `date` sorgu parametresi alınmıyor; okuyucuya verilen ortak tarih sunucuda belirleniyor.
- **Sonuç:** Her iki yeni test hedefli koşuda ve 1022 testlik son tam pakette geçti.

### 3. ✅ [Kapandı] Biçim borcu

- `scripts/browser-checks/milestone-report-menu.mjs` ve `scripts/browser-checks/notifications.mjs` `a0c3a9f` commit'inde biçimlendirildi. `format:check` temiz.

### 4. ✅ [Kapandı] Takım geçmişi ve kendi geçmişine erişim

- **Kesinleşen kural:** Yetki bugünkü organizasyon görevinden, rapor satırının takımı ilgili aydaki görevlendirmeden gelir. Kişi A'dan B'ye geçtiğinde A'nın PO/Lideri A'daki aylarını, B'nin PO/Lideri B'deki aylarını görür. Kişi kendi geçmişinin tamamını ilgili takımlar altında görür. Kendi geçmişine erişim eski takım arkadaşlarına erişim vermez. Admin tümünü görür; aynı ay iki kez toplanmaz.
- **Uygulama:** `activityReportResources` kişileri sorgulanan geçmiş aylardaki takımlarına göre seçer. `readActualReportData` aynı aylarla sayısal verileri okur. Nihai raporda her takım satırı yeniden yetkilendirilir. Kişinin kendi eski takımları filtre kataloğuna eklenir; eski takım arkadaşlarının satırları eklenmez. Gelecekteki kendi görevlendirmesi tarihsel erişimi genişletmez. Aktivite Giriş yazma yetkisi değişmez.
- **Testler:** `tests/actual-entry-access.test.mjs` eski/yeni PO, Team Member, Lider, Admin, Yönetici rolünün etkisizliği, eski takıma geri dönüş ve eski görevin yetkisinin taşınmaması senaryolarını kapsar. `tests/record-access-http.test.mjs` geçmiş SQL okumasını, satır kapsamını, gizlenen ayların kapasite/izin/eğitim alanlarını ve toplamların tekrarlanmamasını doğrular. Hedefli tarayıcıda kişinin iki takım grubu altında kendi geçmişini görmesi ve eski takım arkadaşlarının gizlenmesi kontrol edildi.
- **Dokümantasyon:** Manuel 3.1 HTML/PDF ve README güncellendi. PDF 23 sayfa olarak yeniden üretildi; metin/sayfa sınırları ve değişen 4/17. sayfalar kontrol edildi.

### 5. ✅ [Kapandı] Kaynak dağılımı yokken değerlendirme yüzdeleri boş

- **Teyit:** Açık 3000 ortamındaki değerlendirme ekranında eylül hedef/gerçekleşen değerleri `—` görünüyordu. Salt okunur veritabanı incelemesinde iki liderlikte %60/%60 ve %25/%30 kayıtlı olduğu görüldü; veri kaybı yoktu.
- **Kök neden:** Tek liderliğin kendi yüzdeleri de proje ağırlıklı ortalamasından geçiriliyordu. Kaynak dağılımı kaldırıldığında rapor ağırlığı sıfır oluyor; rapor, senaryo hesabının kullandığı onay anında saklanan kaynak referansına geri dönmüyordu.
- **Eski özel ağırlık alanı:** Admin'in manuel katsayı girdiği arayüz `414cfea` değişikliğinde kaldırılmış. Güncel arayüzde bu ayar yoktur. `ProjectProgress.weight`, şema ve sunucuda eski kayıt uyumluluğu için hâlâ desteklenir. İncelenen yerel ve demo kayıtlarında bu alan tanımlı değildi. Kullanıcının özel ağırlık girmesi gerekmez; yeni ayar eklenmedi, eski alanların uyumluluğu kaldırılmadı.
- **Düzeltme:** Liderlik satırı kendi kayıtlı yüzdelerini doğrudan gösterir. Proje toplamı canlı kaynak paylarıyla; canlı kaynak planı tamamen yoksa onayda saklanan kaynak referansıyla hesaplanır. Mevcut açık özel ağırlık değeri varsa önceki davranışı korunur. Hesaplama kaynağı hiç yoksa proje toplamı bilinmiyor olarak kalır; liderlik değerleri görünmeye devam eder. Eksik gerçekleşen veya onaysız plan için değer üretilmez. Planlanan kaynak sütununa yapay kaynak eklenmez.
- **Kapsam:** Aylık ekran matrisi, liderlik değerlendirmesi ve Excel çıktısı aynı kuralı kullanır. `shared/project-progress.ts`, `progress-management.ts`, `ProgressManagementMatrix.tsx` ve `progress-management-export.ts` güncellendi.
- **Doğrulama:** Onay referansı, canlı planın önceliği, eski sıfır ağırlık, eksik/onaysız veri, doğrudan liderlik yüzdeleri ve Excel eşitliği testleri geçti. Hedefli tarayıcıda özel ağırlık ve canlı kaynak dağılımı olmadan proje hedef/gerçekleşen %50/%70 ve liderlik gerçekleşen %70 görünür olarak doğrulandı.

## Temiz çıkan kontroller

- 001–045 migrasyonlarının hepsinde hem `_sqljs.sql` hem `_mssql.sql` dosyası var. 3 ve 12 iki tarafta da yok; bu, `backend/migration-catalog.mjs` ile tutarlı. `MIGRATIONS.md` de 45'e kadar güncel.
- Kaldırılan `activityTeamScope` başka hiçbir yerde kullanılmıyor.
- Ön yüz kapsamı kendisi hesaplamıyor, sunucunun döndürdüğünü kullanıyor. Kural `shared/` içinde tek yerde.

## Tamamlanan iyileştirmeler

- Geçmiş dönem ve ortak referans tarihini kapsayan HTTP testi eklendi.
- `activityReportResources` ve nihai takım satırı yetkilendirmesi aylık görevlendirmeleri kullanacak şekilde güncellendi; kişinin kendi geçmişi eski takım arkadaşlarına erişim vermiyor.
- Ana Sayfa (İçindekiler) kartlarının başlık altı detay açıklamaları ve kullanılmayan `.home-card-text` stili kaldırıldı. Başlıklar ve ekranı açma davranışı korundu; Admin ve normal kullanıcıyla hedefli tarayıcı kontrolü geçti.
- `npm run verify` ve `npm run deploy:verify` çalıştırıldı; dağıtım manifesti derleme tarafından yenilendi.
- Kullanıcı manueli HTML/PDF ve README sürüm 3.1'de eşitlendi. Yönetici ile organizasyondaki Lider ayrımı, hesap-çalışan eşleşmesi gerekliliği ve Admin istisnası belgelendi; Aktivite Raporu'nun yetki matrisi düzeltildi.
- Manuelin kapak tablosundan Uygulama durumu, Önceki sürüme göre ve Ekran görüntüleri satırları kaldırıldı. Ana Sayfa görseli güncellendi; 23 sayfalık PDF yeniden üretilip doğrulandı.

## Son arayüz ve yetki geliştirmeleri

- **Ay seçimi:** Hedef Plan / Gerçekleşen Plan Giriş ekranının üst filtresindeki ay listesi kaldırıldı. Bekleyen iş kutularının altında, yıl bazında on iki ayı gösteren seçim satırı eklendi. Gelecek ve takip öncesi aylar görünür fakat seçilemez; geçmiş yılların geçerli ayları korunur. Ay değişikliği giriş alanlarını ve durum sayaçlarını günceller; sıfırlama varsayılan aya döner. Değerlendirme raporunun ay listesi korunur.
- **Yönetici kritik konu yetkisi:** Görebildiği projelerde başlık/konu/tarih düzenleme ve Tamamlandı/Çıkar işlemleri açıldı. Proje adı, genel dönem, aşama, sıralama, erişim kuralları, proje ekleme/silme ve gizli projelerin güncellenmesi sunucuda reddedilir. Yöneticiye yalnız görünür projelerin revision bilgisi verilir; erişim kuralları istemcide gizli kalır ve kayıtta korunur. Çakışma kontrolü devam eder.
- **Doğrulama:** `tests/record-access-http.test.mjs` izin verilen düzenleme, erişim kurallarının korunması, gizli proje/revision engeli ve eski revision için 409 kontrolünü kapsar. `tests/scope-index.test.mjs` yeni görünür proje revision sözleşmesine göre güncellendi. Hedefli tarayıcıda ay satırı, mevcut plan/onay/gerçekleşen akışları ve Yöneticiyle konu/tarih/tamamlanma/başlık kaydı doğrulandı. Tam test paketi 1022/1022 başarılıdır.
- **Manuel:** HTML/PDF, README, hedef plan ekran görseli ve yetki matrisi güncellendi. PDF 23 sayfa olarak yeniden üretildi; değişen sayfalar ve tablo yerleşimi kontrol edildi.

## Kalan takip işleri

| İş | Tür | Tamamlanma ölçütü |
|---|---|---|
| Tam `npm run test:ui` paketini çalıştır | Doğrulama | Şifre değiştirme, Aktivite Giriş/Raporu ve diğer tarayıcı senaryoları geçmeli; sonuç rapora eklenmeli. Hedefli Ana Sayfa kontrolü bu paketin yerine geçmez. |
| Uygun MSSQL ortamında `npm run test:db` çalıştır | Ortam bağımlı doğrulama | Native MSSQL testleri geçmeli; kullanılan ortam ve sonuç kaydedilmeli. SQL.js testlerinin başarılı olması native MSSQL kabulü değildir. |

## Notlar

- Önceki geliştirmeler `160f761` ile GitHub'dadır. Bu son ay satırı/Yönetici yetkisi ve manuel değişiklikleri bu raporla aynı commit içinde main dalına alınmıştır.
- Otomatik ve hedefli tarayıcı testleri geçici sentetik SQL.js veritabanları ve rastgele yerel portlarla çalıştı. Gerçek kullanıcı kayıtları test amacıyla değiştirilmedi.
- Görüntüleme sorunu için `data/planlama.sqlite` ve `data/demo-sunum.sqlite`, dosyaya yazmayan SQL.js bellek kopyaları üzerinden incelendi. Kullanıcının isteğiyle 3000 normal, 3001 ayrı demo veritabanı ve ayrı oturum çereziyle çalıştırıldı.
- Son tam doğrulama 1022/1022 test, biçim/tip kontrolü ve derlemeyi kapsar. Kaynak/derleme eşitliği `deploy:verify` ile denetlendi. Manifestteki commit alanı derlemenin alındığı `160f761` tabanını gösterir; gerçek doğrulama kaynak/çıktı karmaları üzerindendir.
