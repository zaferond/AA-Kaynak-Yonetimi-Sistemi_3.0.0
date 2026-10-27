# Güvenlik, mimari, performans ve arayüz incelemesi — 27.10.2026

## Düzeltme durumu — 27.10.2026

D-01 sağlık kontrolü ve T-01 senaryo ismi görünürlüğü kullanıcı talebiyle düzeltildi. [Düzeltme ve doğrulama raporu](saglik-kontrolu-senaryo-duzenleme-duzeltmeleri-2026-10-27.md). G-01 ve B-01 açık kalır. Aşağıdaki inceleme ve yeniden üretim bilgileri düzeltme öncesindeki durumu kaydeder.

## Sonuç ve kapsam

İncelenen kaynak: `main`, `b4f3242e70d18b8563dc73dc11d922c8d812935d`. Yerel 3000 ve 3001 sunucuları, backend/shared/frontend kaynakları, bağımlılıklar, yetki ve oturum akışları, dağıtım bütünlüğü, kullanıcı kılavuzu ve sentetik tarayıcı ortamı kontrol edildi. Bu çalışma bir incelemedir; uygulama kodu, gerçek parolalar ve iş kayıtları değiştirilmedi, commit/push yapılmadı.

**Kalan işler:** Bir yüksek öncelikli eski güvenlik bulgusu, bir yeni orta öncelikli hizmet sürekliliği bulgusu ve iki düşük öncelikli arayüz/belge işi var. Yeni bir yetki aşımı, SQL enjeksiyonu, XSS veya kayıt kaybı bu incelemede doğrulanmadı. Bu ifade bu tür hataların bulunamayacağına dair garanti değildir.

| Öncelik | İş | Durum ve öneri |
|---|---|---|
| Yüksek / G-01 | Git'teki örnekle aynı aktif yerel yönetici parolası | Önceki S-01 sürüyor. İki ortamda değiştirilmeli, eski oturumlar iptal edilmeli; eski değeri kaynaklardan silmek tek başına yeterli değil. |
| Orta / D-01 | Sağlık kontrolünde sınırsız bekleyen DB işi | `/api/health` yavaş DB karşısında zaman aşımından sonra da işi tutuyor. Tek paylaşılan kontrol, kısa sonuç önbelleği ve iş bitene kadar korunan sınır eklenmeli. |
| Düşük / T-01 | Dar ekranda senaryo ismi görünmüyor | 390 px genişlikte isim alanı ilk görünümün sağında kalıyor. Masaüstünde tek satır korunup dar ekranda isim alt satıra alınmalı. |
| Düşük / B-01 | Kullanıcı kılavuzu son iş akışlarını kapsamıyor | 3.2 / 25.10.2026 kılavuzu yeni kart, tamamlanan proje ve hedef dağıtımı akışlarıyla ve yeni görsellerle güncellenmeli. |

## G-01 — Yüksek: Bilinen parola hâlâ aktif

Özel `.env` içindeki ilk kurulum parolası, Git'te izlenen üç metin dosyasında birebir bulunuyor. Değer ve hash rapora alınmadı. Salt/hash doğrulamasıyla aynı değerin hem 3000 hem 3001 veritabanındaki aktif `root-admin` kaydında geçerli olduğu, bu hesaplarda zorunlu değiştirme bayrağının kapalı olduğu doğrulandı. Giriş denemesi yapılıp gerçek yönetici oturumu açılmadı.

Derlenmiş JS/CSS içinde bu değer bulunmadı. `.env` Git'te izlenmiyor, HTTP'den alınamıyor ve dosya izni `0600`. Bu korumalar, başka dosyalardaki açık değerle aynı parolanın kullanılmasını telafi etmez. İki sunucu şu anda `127.0.0.1` üzerinde; bu gözlem internete açık bir saldırı doğrulaması değildir.

**Düzeltme:** Aktif parolalar birbirinden farklı yeni değerlerle değiştirilmeli, ilgili oturumlar iptal edilmeli, eski ilk kurulum değeri özel ortam ayarından çıkarılmalı veya yenilenmeli. Rapordaki/testteki örneklerin gerçek hesapta yeniden kullanılmaması sağlanmalı. Yeni değer Git'e, rapora veya uygulama derlemesine girmemeli. Açığa çıkan kimlik bilgisinin yenilenmesi ve iptali [OWASP sır yönetimi rehberiyle](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) uyumludur.

**Kabul:** Eski değer iki aktif yönetici kaydıyla eşleşmemeli; mevcut yönetici oturumları geçersiz olmalı. Bu tur, kullanıcı talebi inceleme olduğu için gerçek parola değiştirilmedi. 3001'de kullanıcının ayrıca sıfırlattığı üç lider hesabı bu bulgunun konusu değildir.

## D-01 — Orta: Sağlık kontrolü zaman aşımı DB işini sonlandırmıyor

**Kaynak:** `backend/app.mjs:184–198`; `backend/adapters/mssql.mjs:30–32`.

Oturumsuz `GET /api/health` her istekte doğrudan `store.generation()` başlatıyor. `Promise.race` beş saniye sonra HTTP 503 döndürüyor; alttaki işi iptal etmiyor. Bu yol, veri okuma veya rapor işlerinin kabul sınırına dahil değil. MSSQL havuzunun 10 bağlantı sınırı eşzamanlı fiziksel sorguları sınırlar; uygulama tarafında başlatılan/bekleyen sağlık kontrolü işlerine sınır getirmez.

**Sentetik yeniden üretim:** Gerçek DB kullanılmadan `generation()` bekletildi ve 12 eşzamanlı sağlık isteği gönderildi. 12 iş birden başladı. Beş saniye sonunda 12 yanıt da 503 oldu; hâlâ tamamlanmamış DB işi sayısı **12** idi. Bekletme kaldırılınca işler tamamlandı. Üretim MSSQL kesintisi veya sistemin tamamen devre dışı kalması denenmedi; risk, yavaşlık sırasında izleme/istek trafiğinin sorgu kuyruğu ve kaynak tüketimini büyütmesidir. Endpoint erişimi olan bir istemci için giriş gerekmez.

**Düzeltme:** Sağlık istekleri aynı devam eden DB kontrolünü paylaşmalı; kısa süreli sonuç önbelleği ve işlem tamamlanana kadar tutulan eşzamanlılık sınırı olmalı. Varsa sürücü düzeyinde süre/iptal desteği ayrıca kullanılmalı. Proxy erişim veya hız sınırı ek korumadır. Kaynak tüketimini ve eşzamanlı işi sınırlama yaklaşımı [OWASP hizmet engelleme rehberinde](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html) açıklanır.

**Kabul:** Bekletilen DB ile çok sayıda sağlık isteğinde uygulamanın DB kontrolü sayısı belirlenen sınırı aşmamalı; HTTP zaman aşımı bu kotayı erken serbest bırakmamalı; DB iyileştikten sonra kontrol 200'e dönmeli.

## T-01 — Düşük: Küçük ekranda senaryo ismi yatay kaydırmaya saklanıyor

**Kaynak:** `frontend/src/styles/workspace/technical-scenario.css:435–460`.

Senaryo kartının işlem satırı bütün genişliklerde `flex-wrap: nowrap` ve `overflow-x: auto` kullanıyor; isim alanının minimum genişliği 160 px. 390 × 844 tarayıcıda menü kapalıyken alanın sol kenarı **x=422,19 px**, genişliği **72,59 px** ölçüldü. İşlem satırının görünen genişliği 316 px, içeriği 476 px. Sayfanın tamamı taşmıyor; taşma kartın içindeki yatay kaydırmada kaldığından ilk bakışta Senaryo İsmi görünmüyor.

Alan silinmiş veya kaydedilemiyor değil; yatay kaydırma/klavye odağıyla erişiliyor. Bu nedenle veri kaybı değil, keşfedilebilirlik ve kullanım sorunudur. Masaüstündeki kullanıcının istediği tek satır düzeni korunmalı; küçük ekranda isim tam genişlikte ikinci satıra geçmeli. Kabul: 390 ve 768 px genişliklerde isim, işlem butonları ve giriş alanları form içinde yatay kaydırma gerektirmeden görünmeli; masaüstü tek satır kalmalı.

## B-01 — Düşük: Manuelin uygulamayla yeniden eşitlenmesi gerekiyor

**Kaynak:** `docs/kullanici-manueli/README.md:3`, `docs/kullanici-manueli/v3/manual.html` ve güncel uygulama.

Güncel kılavuz 3.2 / 25.10.2026. Son eklenen Senaryo Oluştur ile açılan kart, başarılı kayıttan sonra kapanma, Tamamlanan Projeler sekmesi/Tamamlandı seçimi ve önerilen hedefte önceki-sonraki ayların birlikte hesaplanması anlatılmıyor. Yeni takvim/filtre/panel görünümleri de bütün ekran görüntülerine aktarılmamış. Kullanıcı işlemi değiştiren bu üç akışa öncelik verilmeli; README, HTML, PDF ve görseller aynı belge sürümünde tutulmalı.

## Acil hata sayılmayan iyileştirmeler

- Senaryo giriş kartına **Daralt** veya taslağı koruyan **Vazgeç** eklenebilir. Şu an açıldıktan sonra başarılı kayıt dışında kartı doğrudan kapatan işlem yok; sayfa değiştirip dönmek gerekiyor. Mevcut istenen aç/kaydet/kapat davranışı çalışıyor.
- Ortak dialog bileşenindeki ekran okuyucu metni `Close` yerine `Kapat` olabilir (`frontend/components/ui/dialog.tsx:76`). Tarih simgelerinin ortak `Ay seç` / `Tarih seç` adları alan bağlamını içerebilir (`frontend/src/components/DateField.tsx:168`); örneğin “Başlangıç ayını seç”. Bunlar yeni güvenlik açığı veya kanıtlanmış WCAG ihlali olarak sınıflandırılmadı.
- `frontend/src/App.tsx`, `backend/app.mjs` ve `backend/store.mjs` içindeki ekran/rota/işlem orkestrasyonu ileride alan bazında daha küçük modüllere ayrılabilir. Sırf dosya uzunluğundan işlevsel hata sonucu çıkarılmadı; yetki, revision ve atomik işlem sınırları korunmadan geniş bir yeniden yazım önerilmiyor.

## AD ve yayına geçiş

AD hesaplarının parolası uygulamada değiştirilmez. Yetkilendirilen LDAP hesabı bu ilk girişte yerel parola değiştirme bayrağıyla oluşturulmuyor. Mevcut yerel hesaplar AD açılınca otomatik dönüşmüyor; aynı kullanıcı adıyla yeni AD hesabı oluşturma da çakışma nedeniyle reddediliyor. Geçişte hesap eşleştirme ve eski yerel hesapların kapatılması planlanmalı. Bu, yeni bulunan bir AD bypass hatası değildir.

Yerelde kurum AD bilgileri ve MSSQL erişimi yapılandırılmamış. Gerçek AD/LDAPS sertifikası, kapalı/grup dışı hesap davranışı, Windows/MSSQL şema 47 geçişi, kısıtlı DB hesabı, HTTPS/proxy ve yedekten kurtarma kabulü kurum ortamında ayrıca yapılmalı. Yerel sentetik test başarısı bunların yerine geçmez.

## Doğrulama sonuçları

- **1050/1050 otomatik test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı.
- **339/339 tam izole tarayıcı kontrolü başarılı** (tüm fixture kontrollerinin toplamı).
- Kök ve frontend `npm audit`: **0 bilinen açık**. Bu, aktif kimlik bilgisi bulgusunu kapatmaz.
- `check:secrets` ve dağıtım bütünlüğü başarılı. Genel sır deseni taraması, Git'teki örnekle aynı aktif parolayı tek başına yakalamıyor; G-01 ayrıca doğrulandı.
- İki portta ana sayfa ve sağlık 200, oturumsuz `/api/data` 401; `/.env`, `/.git/config`, `/backend/server.mjs`, `/data/planlama.sqlite`, `/deployment-manifest.json` 404. CSP ve `nosniff` başlıkları mevcut.
- `.env` ve iki SQL.js dosyası `0600`, `data/` `0700`. Güncel derlenmiş JS/CSS'de yapılandırılmış yönetici parolası bulunmadı. Bu yerel ortamda ayrıca harici servis API anahtarı yapılandırıldığı görülmedi; API kimlik doğrulaması oturum çerezi/CSRF ile yapılıyor.
- Önceki S-02, L-01, L-02, U-01 ve P-01 düzeltmeleri kodda mevcut; ilgili regresyon kontrolleri yeniden çalıştırıldı.
- Sentetik SQL.js ölçümü: 200 kaynak, 1.000 gerçekleşen kayıt, 1.000 takvim günü, 1.000 başlangıç audit kaydı; her büyüklükte üç örnek. 1.000 plan dağılımında tek kayıt güncelleme medyanı **30,16 ms**, 10.000 dağılımda **61,29 ms**. `production` komut yolu ve `delta` yanıt kullanıldı. Bu, HTTP/AD/MSSQL ağ gecikmesi veya eşzamanlı üretim yükü ölçümü değildir.
- Masaüstü 1366 × 900 ve telefon 390 × 844 senaryo/proje/değerlendirme görünümleri incelendi; bu ek görsel oturumda JavaScript hatası görülmedi. T-01 iç form taşması ayrıca kaydedildi.

Kanıtlar: `/tmp/aa-audit-20261027-*`; ek görseller/tekrar üretim kodu `tmp/audit-20261027/` altında. Bunlar sentetik/geçici dosyalardır ve Git'e eklenmez. Hiçbir parola değeri veya hash bu raporda yer almıyor.
