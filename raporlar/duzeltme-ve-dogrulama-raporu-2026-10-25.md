# Düzeltme ve doğrulama raporu — 25.10.2026

Taban: `main / 9cd94ba4a60f3d30b350375d5b890eb46091d360` üzerine yerel değişiklikler. İnceleme kaynağı: [24 Ekim güvenlik, mimari ve hata raporu](guvenlik-mimari-hata-incelemesi-2026-10-24.md).

## Yapılan düzeltmeler

| Bulgu | Düzeltme | Kanıt |
|---|---|---|
| Giriş isteğiyle süreç kapatma | Express 5.3.0 / body-parser 2.4.0; giriş, normal ve toplu JSON ayrıştırıcılarında `inflate: false` | Zararlı gzip örneği 415 alıyor; sonrasında sağlık ve normal giriş çalışıyor. Yetkili normal/toplu istekler de 415 ile, veri değiştirmeden reddediliyor. |
| Hesaplar arasında senaryo taslağı | Taslak ve karşılaştırma anahtarları kullanıcı kimliğine bağlandı; sahibi bilinmeyen eski ortak anahtarlar temizleniyor. Kullanıcı değiştiğinde hook durumu da ayrılıyor. | Gerçek çıkış/giriş tarayıcı testi: admin → manager → admin; her hesap yalnız kendi taslağını görüyor. Aynı hesapta yenileme taslağı koruyor. |
| Ay sınırında Aktivite Giriş sıfır değeri | Store, kısmi okuyucu, kişi kapsamı ve son görünüm aynı referans tarihini kullanıyor. | İstanbul'da 31 Ekim → 1 Kasım sınırını geçen okuma ve bir sonraki ay takım değiştiren PO senaryosu geçti. |
| Zod güvenlik uyarısı | Sunucu ve ön yüz Zod 4.6.7'ye geçirildi. Record API'leri, enum kayıtlarının kısmi olması ve sayı doğrulama farkları uyarlandı. | Şema, içe aktarma, yedek/arşiv/kurtarma testleri geçti; iki audit de temiz. |
| Büyük geçersiz girdilerde hata birikmesi | Komut/snapshot dizileri erken duruyor; büyük geçersiz sayısal sözlükler tek kayıt hatasında reddediliyor. | 5000 geçersiz nesne/kayıt ve 100001 elemanlık sınır aşımı için hata sayısını sınırlayan regresyonlar geçti. |
| Azure/MSAL uyarısı | MSSQL 12.7.11, Azure identity 4.14.0 ve identity altında MSAL 7.1.1 override; Tedious 20.3.8 korundu. | Kök audit sıfır açık; sürücü/SQL–NTLM yapılandırması ve adapter sözleşme testleri geçti. Gerçek native bağlantı kabulü ayrıca gerekli. |
| Native MSSQL'de `/api/data` 500 | Sabit 16 sorguluk metadata sınırı, tek kaynak olan güncel sorgu kataloğunun büyüklüğüne bağlandı. Katalog şu anda 17 sorgu içeriyor. | Sürücü sınırından güncel kataloğun tamamını geçiren regresyon testi eklendi; SQL/rowset doğrulaması korunuyor. |
| Tarayıcı CI kaydırma yarışı | Bekleyen eşitleme frame'i, karşı tablonun scroll olayı henüz gelmemiş daha yeni konumunu ezmiyor. | Gecikmiş olay sırasını yeniden üreten iki yönlü kaydırma regresyonu; tam tarayıcı paketindeki ilgili kontrol de geçti. |
| Başarısız CI kanıtlarının kaybolması | Tarayıcı sonuçları/görüntüleri/günlüğü ve native günlük/raporları başarısızlıkta da artifact olarak yükleniyor. | Workflow adımları `if: always()` kullanıyor. Bash pipefail korunuyor; `tee` test hatasını başarıya çevirmiyor. |

## CI hatalarının doğrulanmış kök nedenleri

Önceki incelemede public API günlük indirmesi 403 vermişti. Bu düzeltme çalışmasında makinedeki mevcut GitHub kimliğiyle salt okunur günlük erişimi sağlandı; kimlik bilgileri çıktıya yazılmadı.

[Aynı taban commit'in koşusunda](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/actions/runs/40122640163):

- **Native:** `GET /api/data` isteği `Invalid snapshot metadata query batch` hatasıyla 500 dönüyor. Sorgu kataloğu 17 öğe, adapter sınırı 16. Test beklentisi gevşetilmedi; üretim adapter'ının sınırı düzeltildi.
- **Tarayıcı:** `horizontal-scroll.mjs` içinde `source reaches its own edge` zaman aşımı var. Bekleyen eşitleme işi daha yeni karşı tablo hareketini ezebiliyor. Sadece bekleme süresini uzatmak yerine olay sırasındaki yarış düzeltildi.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | Başarılı: biçim, **1030/1030 test**, TypeScript, üretim derlemesi; başarısız/atlanan yok |
| Yeni senaryo hesap izolasyonu tarayıcı kontrolü | Başarılı |
| Tam `node scripts/run-browser-checks-isolated.mjs` | **Başarılı, çıkış kodu 0; toplam 309 PASS kontrolü.** Sondaki `checks: 180` yalnız son ortak fixture'a aittir; önceki ayrı fixture'lar da toplam sayıya dahildir. |
| Kök `npm audit --audit-level=moderate` | **0 açık** |
| Ön yüz `npm audit --audit-level=high` | **0 açık** |
| `npm run deploy:verify` | Başarılı; kaynak ve çıktı farkları boş |
| Temiz yayın paketi kabulü | Başarılı; 652 kaynak / 72 çıktı |
| Yerel uygulama | Yeni kodla yeniden başlatıldı; `http://localhost:3000/api/health` → `{"status":"ok"}` |

Yeni regresyonlar: `tests/compressed-request-http.test.mjs`, `tests/validation-budget.test.mjs`, `tests/synchronized-table-scroll.test.mjs`; ayrıca `tests/actual-report-reader.test.mjs`, `tests/mssql-batch.test.mjs` ve `scripts/browser-checks/scenario-session-isolation.mjs`.

Testler rastgele portlar ve geçici sentetik veritabanlarıyla çalıştı. Gerçek iş kayıtları test amacıyla değiştirilmedi. Önceden çalışan yerel sunucu, derleme/doğrulama tamamlandıktan sonra normal kapanışla yenilendi.

## Bakım notları ve kalan kabul işleri

- **Native MSSQL / Windows / GitHub yayın kapısı:** Bu değişiklikler henüz commit/push edilmedi. Yerelde Docker/SQL Server olmadığı için native koşu burada tekrarlanmadı. Kök neden düzeltildi ve adapter regresyonu geçti; gerçek MSSQL'in başarılı olduğu iddia edilmiyor. Yeni commit gönderildikten sonra native, Windows ve release acceptance aynı commit'te yeşil olmalı.
- **Zod sürüm sözleşmesi:** 4.6.7 iki tarafta da sabitlendi. Koleksiyonlarda ilk hatada durmak için sürüme bağlı core parse context'i yalnız `shared/validation-options.ts` içinde tutuluyor; klasik parse tipinde bu seçenek henüz yok. Sürüm değişiminde validation-budget testleri ve şema regresyonları zorunlu. Büyük sözlüklerde ayrıca uygulamaya ait hata bütçesi var.
- **MSAL override:** Azure identity'nin varsayılan zinciri henüz MSAL 6 istiyor. Güvenlik yaması için identity altındaki MSAL 7.1.1'e dar override uygulandı. İncelenen 7.x değişikliği interaktif girişin kaldırılmış `responseMode` seçeneğiyle ilgili; identity'nin ilgili çağrılarında bu seçenek kullanılmıyor. Uygulama SQL/NTLM ve ayrı LDAP akışını kullanıyor. İleride identity yamalı zinciri kendisi getirdiğinde override kaldırılarak native kabul yenilenmeli. [MSAL üretici değişiklik kaydı](https://raw.githubusercontent.com/AzureAD/microsoft-authentication-library-for-js/dev/lib/msal-node/CHANGELOG.md).
- **Kurum ortamı:** Yedekten dönüş tatbikatı, kurumsal proxy/LDAPS sertifikaları, servis izleme ve üretim ölçeğinde yük kabulü ortam bağımlı işler olarak sürüyor. Bunlar yerel test sonucu veya kod değişikliğiyle tamamlanmış sayılmadı.

Yerel günlükler: `/tmp/aa-fix-verify.log`, `/tmp/aa-fix-browser.log`, `/tmp/aa-fix-audit-root.log`, `/tmp/aa-fix-audit-frontend.log`, `/tmp/aa-fix-deploy.log`, `/tmp/aa-fix-package.log`. Bunlar geçici dosyalardır; Git'e eklenmedi.
