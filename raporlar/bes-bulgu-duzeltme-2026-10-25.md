# Beş bulgunun düzeltilmesi — 25.10.2026

Kaynak: [API, sır yönetimi, güvenlik, mimari ve arayüz incelemesi](api-sir-yonetimi-guvenlik-mimari-arayuz-2026-10-25.md). Değişiklikler `main / 9cd94ba` üzerine uygulandı. Bu rapor, main dalına alınacak düzeltmeleri ve tamamlanan yerel doğrulamaları kaydeder.

## Düzeltmeler

| Bulgu | Son davranış | Kanıt |
|---|---|---|
| Değerlendirme taslağının uzaktan güncellemede kaybolması | Kirli kart, açılıştaki kayıt/veri/revision ile korunuyor. Arka plan tam veri okuması taslak bitene kadar bekliyor. Kaydetme açılış revision'ıyla yapılıyor; eski veri yeni revision'a sessizce taşınmıyor. Sekme değişimi/çıkışta taslağı bırakma onayı var; açık iptal düğmesi güncel kayda dönüyor. | Tarayıcıda yerel **37** taslağı, uzaktaki **25** kaydı sonrası görünür kaldı. Kaydetme **409** verdi; DB'deki 25 değişmedi. Gezinmeden vazgeçmek taslağı korudu; açık iptal uzak kaydı yükledi. Uzaktan ay kilidi sonrasında 39 taslağı korundu, sunucu kilit nedeniyle 409 verdi; hedef plandaki 77 taslağı da uzak kayıt sonrası korundu ve eski revision ile 409 verdi. |
| Büyük takvim sözlüklerinde hata birikmesi | `shared/bounded-record-schema.ts` büyük sözlükleri kayıt başına doğrulayıp ilk bozuk kayıtta durduruyor. Ortak/kişisel takvim ve ilgili metin/proje sözlüklerinde kullanılıyor. Küçük girdilerin mevcut hataları, geçerli büyük girdilerin değer/sırası korunuyor. | 5000 bozuk ortak/kişisel takvim kaydında hata sayısı sınırlandı. 5000 geçerli kaydın çıktısı standart Zod sonucu ile birebir eşleşti. |
| Zayıf bootstrap/reset parolası | `assertAdminPassword`, yer tutucu/kullanıcı adı kontrolüne ek olarak 10–256 karakter ve yeni parola güç denetimini uygular. Setup, ilk hesap oluşturma ve CLI reset aynı yardımcıyı kullanır. | Tekrarlanan harf/sembol, sıralı rakam, kısa/çok uzun parola hem `ADMIN_PASSWORD` hem `NEW_ADMIN_PASSWORD` yolunda reddedildi. Mevcut hesapların parola özetleri değiştirilmedi. |
| Ortam dosyalarının Git koruması | Paylaşılan `.env*` ignore kuralı var; yalnız `.example` şablonları istisna. Boş `.env.mssql` indeksten çıkarıldı; yerel dosya silinmedi. `npm run check:secrets` ve CI kontrolü eklendi. | Temiz geçici Git deposunda gerçek ayar çeşitleri ignore edildi; örnek dosyası izlenebildi. Zorla eklenen gerçek ayar adı ve sentetik token tespit edildi; eşleşen sır çıktıya yazılmadı. |
| Hareketsizlik ve ayrı yönetici oturum politikası eksikliği | Sunucuda kalıcı son etkinlik alanı ve **30 dakika** idle sınırı. Yalnız CSRF korumalı açık etkinlik isteği yeniler; poll/me/version/arka plan okumaları yenilemez. Admin, Yönetici ve Normal-Proje için **8 saat** mutlak sınır ve kalıcı hatırla çerezi yok. | HTTP testleri poll'ün süre uzatmadığını, etkinliğin süreyi yenilediğini, süresi dolanın yeniden canlandırılamadığını ve mutlak sınırın etkinlikle aşılamadığını doğruladı. |

Kart koruması `ProgressCard`, `ProjectProgressPanel`, `useWorkspaceNavigation` ve `usePortalRefresh` üzerinden bağlandı. Önceden var olan ay değiştirme davranışı korunur; uzak güncelleme, açık ay seçimiyle karıştırılmaz.

## Oturumun kullanıcıya etkisi

- Hareketsizlik sınırından **5 dakika önce** uyarı görünür. “Oturumu Sürdür” gerçek sunucu etkinliğini yeniler; başarısız bağlantıda hata gösterilir.
- Mutlak süre uzatılamaz. Bu sınıra yaklaşınca kullanıcıya kaydedip yeniden giriş yapması söylenir; çalışmaya kısa süreli dönüp kaydetme seçeneği bulunur.
- Yüksek yetkili uygulama hesapları: admin, manager ve projectEditor. Aktivite raporu/girişinin organizasyon görevi kuralları değişmedi.
- Diğer hesapların mevcut 12 saat / yerel hatırla için 30 günlük mutlak sınırları korunur; 30 dakika hareketsizlik hepsine uygulanır. Hatırla seçimi hareketsizlikten sonra yeniden giriş zorunluluğunu kaldırmaz.
- Etkinlik isteği en fazla dakikada bir gönderilir; kullanıcı etkileşimi olmayan otomatik sorgular oturumu açık tutmaz. Son etkinlik güncellemesi eski bir isteğin daha yeni zamanı geri almasını engelleyecek şekilde monotondur.
- Oturum süreleri sunucuda denetlenir; yalnız tarayıcı sayacına güvenilmez. Sunucunun verdiği zamanlar istemci saat farkı dikkate alınarak gösterilir.

## Şema ve çalışan uygulamalar

Migration **46** `kp_sessions.last_activity_at` alanını ekler. Eski etkinlik zamanı bilinmeyen oturumlar bir kez iptal edilir. İş kayıtları ve kullanıcı/parola kayıtları değiştirilmez. Sonraki yeniden başlatma yeni oturumları tekrar iptal etmez.

Yerel uygulamalar kontrollü durduruldu. Kilitler bırakıldıktan sonra, geçiş öncesi iki tam dosya kopyası alındı:

`data/security-backup-1792935711163/`

- `main-before-46.sqlite`
- `demo-before-46.sqlite`
- `manifest.json` — dosya SHA-256 değerleri

Dizin izinleri **0700**, dosyalar **0600**; `data/` Git dışındadır. Bu yedekler önceki 45 şemasındadır; geri dönüşte şemaya uygun uygulama sürümü ve normal kurtarma prosedürü kullanılmalıdır. Sırlar rapora yazılmadı.

Geçişten sonra her DB'nin bellek içi salt okunur kopyası yedekle karşılaştırıldı: oturum/migration tabloları hariç **27 tablonun tamamı**, hesaplar ve parola özetleri dahil, birebir aynı. İkisinde de şema **45 → 46**.

- Ana uygulama: `http://localhost:3000`, ana DB.
- Demo: `http://localhost:3001`, ayrı demo DB ve `kp_test_session` çerezi.
- İkisinde de sağlık kontrolü **200**. Oturumsuz `/api/data` **401**; `/.env` ve `/data/planlama.sqlite` **404**. Geçiş nedeniyle yeniden giriş gerekir.

MSSQL üretimde otomatik DDL açılmadı. Gerçek üretim geçişinde bütün uygulama örnekleri durdurulmalı, tam yedek alınmalı ve DBA/migration hesabıyla `npm run db:migrate` çalıştırılmalıdır. Aynı DB'ye eski ve yeni uygulama sürümleri birlikte bağlanmamalıdır.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Tam `npm run verify` | **1038/1038** test; biçim, TypeScript ve üretim derlemesi başarılı; başarısız/atlanan yok |
| Hedefli gerçek tarayıcı kontrolleri | Taslak/CAS/iptal, uzaktan ay kilidi, hedef plan taslağı ve idle uyarısı/sürdürme/süre dolması başarılı |
| Tam izole tarayıcı paketi | **311/311** kontrol başarılı; süreç çıkış kodu 0 |
| `npm run check:secrets` | Başarılı |
| Kök ve ön yüz audit | İkisi de **0 açık** |
| Temiz yayın paketi | Başarılı; 659 kaynak / 66 çıktı |
| Migration regresyonu | İş/hesap verisi korunuyor, eski oturumlar iptal oluyor, ikinci açılışta yeni oturum korunuyor |
| Gerçek yerel geçiş karşılaştırması | İki DB'de ayrı ayrı 27 iş/hesap tablosu değişmedi |

İlk tam tarayıcı denemesinde rapor tabloları yüklenmeden `.all()` ile sayan eski bir test zamanlama sorunu görüldü. Uygulama hatası/JavaScript hatası kaydı yoktu. Test iki tabloyu da görünür olarak bekleyecek biçimde düzeltildi; scroll eşitliği ve iki yönlü kontrol korunuyor. Ayrıca filtre testinde Escape sonrası kapanış animasyonu tamamlanmadan sonraki seçicinin açılması rastlantısal odak kaybına neden oluyordu; test, önceki panelin DOM'dan ayrılmasını bekleyecek biçimde düzeltildi. Filtre kontrolü tek başına üç tekrarda da geçti. Bu düzeltmelerden sonra tam izole paket **311 kontrolle başarılı** tamamlandı. Ardından genişletilmiş taslak kontrolü uzaktan ay kilidi ve hedef plan çatışmasını da başarıyla doğruladı; JavaScript hata listesi boştu.

Eklenen testler: `session-idle-http.test.mjs`, `session-policy-migration.test.mjs`, `secrets-policy.test.mjs`; parola ve doğrulama bütçesi testleri genişletildi. Tarayıcı paketi `progress-draft-protection.mjs` ile genişletildi. Önceki testlerdeki eski şema/hatırla beklentileri yeni politikaya uyarlandı; erişim ve çakışma denetimleri gevşetilmedi.

## Kalan ortam kabulleri

Gerçek native MSSQL, Windows ve aynı yeni commit üzerinde GitHub release acceptance bu yerel koşuda çalıştırılmadı. Native SQL Server ortamı bu makinede yok. Kurumsal TLS/proxy/LDAPS, yedekten dönüş ve üretim yük kabulü de kurum ortamında yapılmalıdır.

Sır denetimi bilinen kalıpları ve gerçek ayar dosyalarının izlenmesini kontrol eder; her olası kodlanmış sır biçimini ispatlayan bir adli tarama veya secret yönetim sistemi değildir.

Günlükler: `/tmp/aa-five-verify-complete.log`, `/tmp/aa-five-browser-complete.log`, `/tmp/aa-five-ui-focused.log`, `/tmp/aa-five-ui-extended.log`, `/tmp/aa-five-audit-root.log`, `/tmp/aa-five-audit-frontend.log`, `/tmp/aa-five-secrets.log`, `/tmp/aa-five-package-final.log`.
