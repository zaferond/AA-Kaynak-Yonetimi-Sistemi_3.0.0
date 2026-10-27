# Güvenlik, mimari, performans ve arayüz incelemesi — 26.10.2026

Güncel inceleme: [27.10.2026 raporu](son-guvenlik-mimari-performans-arayuz-incelemesi-2026-10-27.md).

## Düzeltme durumu — 26.10.2026

S-02 (oturum kotası), L-01 (değerlendirme filtreleri), L-02 (aksiyon taslağı), U-01 (kapatma simgesi) ve P-01 (gzip sunumu) düzeltildi. Ayrıntılar ve güncel doğrulama sonuçları [düzeltme raporunda](duzeltme-ve-dogrulama-raporu-2026-10-26.md).

**S-01, aktif yönetici parolasının depodaki örnekle aynı olması, açık kalmıştır.** Bu tur kullanıcının istediği orta/düşük öncelikli düzeltmeleri kapsar; parola veya gerçek hesap bilgileri değiştirilmedi. Aşağıdaki bulgular ilk incelemenin tarihi kaydıdır.

## Sonuç ve kapsam

**6 doğrulanmış bulgu: 1 yüksek (P1), 3 orta (P2), 2 düşük (P3).** Önceki incelemedeki üç bulgu yeniden üretildi. Bu tur ayrıca doğrulanan bulgular; yerel aktif yönetici parolasının depoda bulunan bir parola ile aynı olması, takvim uyarılarında kaydedilmemiş aksiyon taslağının kaybolması ve hazır gzip çıktılarının doğrudan Node sunucusunda kullanılmaması.

- Geliştirme kaynağı: `main / 779a49a49ca79b67c98d0cdd1a4e79e27f6f559d`.
- Çalıştırma deposu: temiz klon `4.0.0 / c1c9b7db4ce7d6c214a4ceb34513b152a46b734c`. Backend, shared ve frontend kapsamındaki **560 uygulama dosyası aynı**; dağıtım envanteri doğrulandı.
- 3000 ve 3001 yeniden başlatıldı; ikisinde `/api/health` **200**. Sunucular `127.0.0.1` üzerinde; bu bir internet yayını değildir.
- Çalışan iş veritabanlarına test kaydı yazılmadı. Kimlik bilgisi doğrulaması, SQL.js dosyalarının salt okunur bellek kopyalarında yapıldı; HTTP üzerinden gerçek hesapla giriş denenmedi. İşlevsel senaryolar ve performans deneyleri geçici sentetik veritabanları kullanır.
- Bu tur uygulama düzeltmesi veya parola değişikliği yapılmadı. Rapor ve geçici inceleme kanıtları üretildi.

Testlerin başarılı olması aşağıdaki yeni senaryoların hatasız olduğu anlamına gelmez. Yeni bir oturumsuz iş verisi erişimi veya rol yükseltme doğrulanmadı; buna karşılık aşağıdaki aktif parola bulgusu, bağımlılık ve anahtar deseni taramalarından bağımsızdır.

## S-01 — P1: Depoda bulunan parola aktif yerel yönetici hesabında geçerli

**Bu tur aktif hesap üzerinden doğrulanan öncelikli güvenlik bulgusu.** Yerel `.env` içindeki `ADMIN_PASSWORD`, izlenen dosyalardaki bir parola ile tam olarak eşleşiyor. Aynı değer hem `data/planlama.sqlite` hem `data/demo-sunum.sqlite` içindeki aktif kök yönetici hesabının scrypt kaydıyla doğrulandı. Her iki hesapta da `must_change_password=false`.

Parolanın kendisi bu rapora, terminal çıktısına veya kanıt JSON'una yazılmadı. Eşleşen mevcut dosyalar:

- `MIMARI-VERITABANI-GUVENLIK-PERFORMANS-INCELEMESI-2026-10-23.md:56`
- `tests/admin-password.test.mjs:54`
- `tests/password-change-http.test.mjs:102`

Bu, bir harici API anahtarı sızıntısı değildir; uygulamada kullanılan yönetici kimlik bilgisinin depodaki örnek/test içeriğiyle aynı olmasıdır. Deponun erişebilenlerce okunabilir olması, bu değerin sır kabul edilemeyeceği anlamına gelir. Şu anda yalnız yerel erişim olması maruziyeti sınırlar; aynı kimlik bilgisiyle dış erişim açılması uygun değildir. Üretimde başka bir parola kullanılıyorsa bu kontrol onun ele geçirildiğini göstermez.

**Düzeltme:** İki yerel veritabanı için birbirinden ve örneklerden farklı, rastgele yönetici parolaları belirlenmeli; eski oturumlar iptal edilmeli. İlk kurulum/sıfırlama parolası normal kullanım parolası olarak bırakılmamalı. Eski rapordaki açık parola kaldırılmalı; geçmişteki değerin artık kullanılmadığı doğrulanmalı. Test sabitlerini gizlemek veya dosyayı `.gitignore` içine almak tek başına yeterli değildir; asıl işlem aktif kimlik bilgisini değiştirmektir. Açığa çıkan kimlik bilgisinin yenilenmesi ve iptali, [OWASP sır yönetimi rehberi](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) ile uyumludur.

**Kabul:** Eski değer, her iki veritabanındaki aktif parola kaydıyla artık eşleşmemeli; önceki oturumlar reddedilmeli; yeni parola veya hash raporlara, uygulama derlemesine ve Git'e girmemeli. Değiştirme işlemi gerçek hesapları etkilediğinden ayrıca uygulanacak düzeltme adımıdır.

## S-02 — P2: Oturum etkinliği işinin kotası bağlantı kesilince erken bırakılıyor

**Önceki rapordaki bulgu sürüyor.** `backend/app.mjs:431` içindeki `/api/auth/activity`, `admission.handler(...)` kullanmıyor. `backend/mutation-admission.mjs:193–198` bağlantı kesildiğinde başlamamış sayılan işi serbest bırakıyor; bu yolda DB işi hâlâ çalışabiliyor.

**Yeniden üretim:** Aktif sınır 1, bekleyen sınır 0 olan sentetik uygulamada ilk `touchSession` geciktirildi. İstemci ayrıldıktan sonra ikinci istek de yürütmeye girdi. Aynı anda devam eden etkinlik işi **2**, ikinci istek sonucu **200**.

Middleware normal isteklerde uygulanıyor; sorun genel olarak kotasızlık değildir. Geçerli oturum ve CSRF gerektiren bir yoğunluk/erişilebilirlik sorunudur. SQL.js seri yürütmesi ve MSSQL havuz sınırları ayrıca vardır; bu kontrol bir üretim saldırı veya kapasite deneyi değildir.

**Düzeltme:** Etkinlik handler'ı mevcut admission yaşam döngüsüne alınmalı. Slot, istemci ayrıldığında değil sunucudaki iş bittiğinde bırakılmalı; kuyruk sonrası yeniden kimlik doğrulama korunmalı.

**Kabul:** İlk iş sürerken bağlantı kesilse de ikinci iş sınırı aşmamalı; süre dolumu, CSRF, mutlak süre ve generation değişmeme kuralları korunmalı.

## L-01 — P2: Değerlendirme filtresi kaydedilmemiş gerçekleşen taslağını siliyor

**Önceki rapordaki bulgu sürüyor.** `frontend/src/features/project-progress/PlanAndEntry.tsx:163–179` kartları filtreliyor. `ProgressCard.tsx:83–85` kart kaldırılınca kirli kayıt bildirimini temizliyor; yerel form state'i de kaldırılıyor. Proje sorumlusu filtresi de kartları üst veri kümesinden çıkarabiliyor (`ProjectProgressPanel.tsx:62`).

**Yeniden üretim:** Gerçekleşen alanına **37** ve açıklama girildi; kaydedilmedi. Hedef plan filtresi `Proje Ekibi Onayında` yapılıp `Tümü`ne dönüldü. Alan **boş** geldi; onay penceresi **0**, gizlenen kart için taslak bildirimi **0**, DB'de gerçekleşen kaydı **yok**.

**Etki:** Kaydedilmiş veri silinmiyor; kullanıcının henüz kaydetmediği çalışma kayboluyor. Açık ay değiştirmeye ilişkin daha önce kabul edilmiş davranış bu bulgudan ayrıdır.

**Düzeltme:** Taslak proje/liderlik/ay kimliğiyle filtre dışındaki bir katmanda korunmalı veya kartı kaldıran filtreler bırakma onayına bağlanmalı. Durum, bekleyen işler, liderlik, sorumlu ve filtre sıfırlama birlikte ele alınmalı.

**Kabul:** Filtreye gidip dönünce 37 ve açıklama korunmalı veya kullanıcı önceden açıkça bırakmayı onaylamalı. Taslak, açıldığı revision'ı korumalı; uzak veri üzerine sessizce yazmamalı.

## L-02 — P2: Takvim uyarısında başka satıra geçmek aksiyon taslağını sıfırlıyor

**Yeni bulgu.** `frontend/src/features/project-progress/ScenarioWarningsPanel.tsx:440–449` başka bir uyarının `Aksiyon Gir` düğmesine basıldığında `editing`, açıklama, sorumlu ve tarihi doğrudan değiştiriyor/sıfırlıyor. Taslak uyarıya göre saklanmıyor ve bırakma onayı yok.

**Yeniden üretim:** A uyarısında açıklama, sorumlu ve 30.10.2026 hedef tarihi dolduruldu. B uyarısının `Aksiyon Gir` düğmesine, ardından tekrar A'nın düğmesine basıldı. Üç alan da **boş** geldi; onay penceresi **0**. A'nın DB durumu `seen` kaldı; kaydedilmiş aksiyon veya geçmiş kaydı silinmedi.

**Düzeltme:** Taslaklar uyarı kimliğine göre tutulmalı veya dolu formu değiştiren işlem önce bırakma onayı istemeli. Sekme değişimi ve açık formun kapanması da aynı taslak korumasını kullanmalı. Kaydetme, taslağın açıldığı revision ile yapılmalı.

**Kabul:** A → B → A geçişinde üç alan korunmalı veya açık bırakma onayı gelmeli; kayıt gerçekleşmeden geçmişe aksiyon eklenmemeli. Kaydetme hatası ve revision çatışması taslağı korumalı.

## U-01 — P3: Oturum uyarısının kapatma simgesi çalışmıyor

**Önceki rapordaki bulgu sürüyor.** `frontend/src/SessionActivity.tsx:83` kontrollü `Dialog` için `onOpenChange` boş. `frontend/components/ui/dialog.tsx:53,70–77` varsayılan kapatma düğmesini ve İngilizce `Close` etiketini oluşturuyor.

**Yeniden üretim:** Sentetik oturumun mutlak bitişi dört dakika sonrasına alındı. Görünen `Close` düğmesine basıldı; pencere açık kaldı. `Çalışmayı Kaydetmek İçin Dön` çalıştı. 390 × 844 görünümünde de simge mevcut.

**Düzeltme:** Kapatma simgesi kaldırılmalı veya güvenli dönüş davranışına bağlanıp Türkçe erişilebilir ad verilmeli. Mutlak oturum süresi uzatılmamalı.

**Kabul:** Görünen her kapatma kontrolü tanımlı biçimde çalışmalı; süre dolumu ve yeniden giriş kuralları korunmalı.

## P-01 — P3: Hazır gzip çıktıları doğrudan Node sunucusunda kullanılmıyor

**Yeni performans bulgusu.** `frontend/build.mjs:56–62` ve JavaScript kopyalama adımı `.gz` üretirken `backend/app.mjs:698–709` yalnız standart `express.static` kullanıyor. `Accept-Encoding: gzip` gönderilmesi hazır dosyanın seçilmesini sağlamıyor.

3000 üzerinde salt okunur HTTP ölçümü:

| Dosya | Aktarılan ham bayt | Hazır gzip bayt | Yanıt |
|---|---:|---:|---|
| Giriş JavaScript'i | 254.301 | 81.801 | 200; Content-Encoding yok |
| Ana CSS | 645.524 | 112.415 | 200; Content-Encoding yok |
| Toplam | **899.825** | **194.216** | Gövde ham dosyayla birebir aynı |

Bu iki dosyada yaklaşık **%78 daha az aktarım** mümkün. Bu bir sayfa açılış süresi ölçümü değildir; ilk/önbelleksiz yüklemenin aktarım maliyetidir. Hash'li dosyaların uzun ömürlü önbelleği tekrar açılışlarını azaltır. Üretimde reverse proxy gzip/Brotli uyguluyorsa o ortamda sonuç farklı olabilir; bu inceleme doğrudan Node yayınını doğrular.

**Düzeltme:** Hazır gzip dosyalarını doğru `Content-Encoding`, `Content-Type` ve `Vary: Accept-Encoding` ile seçen bir statik sunum katmanı veya doğrulanmış proxy sıkıştırması kullanılmalı. Genel CSS birleştirmesinin minifikasyonu ayrıca değerlendirilebilir. [Express performans rehberi](https://expressjs.com/en/advanced/best-practice-performance/) uygulama veya reverse proxy katmanında gzip kullanımını açıklar.

**Kabul:** gzip destekleyen istemci sıkıştırılmış karşılığı, desteklemeyen istemci ham dosyayı almalı. HTML yenilenebilirliği, hash'li dosya önbelleği, CSP ve doğru MIME korunmalı; içerik iki kez sıkıştırılmamalı.

## API anahtarları, sırlar ve doğrulanan korumalar

- Uygulamanın kendi API'si için tarayıcıya dağıtılan bir API anahtarı gerekmiyor. Oturum; rastgele token'ın HttpOnly/SameSite çerezde taşınması, sunucuda hash ile tutulması, Origin/CSRF ve kullanıcı/nesne yetkileriyle yönetiliyor (`backend/auth.mjs`, `backend/app.mjs`, `backend/session-policy.mjs`).
- Harici servis anahtarı, DB parolası ve AD bind parolası tarayıcı koduna eklenmemeli. Mevcut build yalnız `NODE_ENV` ve risk arayüzü bayrağını sabitliyor; `.env` içeriğini topluca tarayıcıya aktarmıyor.
- Güncel 32 metin build dosyasında bilinen anahtar desenleri ve yapılandırılmış yönetici parolası eşleşmesi **yok**. İzlenen dosyalarda bilinen GitHub/AWS/OpenAI/Google anahtarı veya özel anahtar deseni doğrulanmadı. Bununla birlikte S-01'deki sıradan parola eşleşmesi mevcut desen denetiminin kapsamı dışındadır.
- Yerel erişilebilir Git geçmişindeki **134 commit / 2.711 metin blob'u** kontrol edildi. Altı tarihsel blob'da yapılandırılmış yönetici parolası eşleşmesi bulundu. Boyutu 2 MB'ı aşan 12 blob ve ikili içerikler metin deseni taramasının dışındadır; bu bir sınırsız adli sır taraması değildir.
- Gerçek `.env` ve `.env.demo` Git'te izlenmiyor ve **0600**. `data/` **0700**, iki aktif SQLite dosyası **0600**. `.env.mssql` izlenmiyor; bu incelemede dolu parola/anahtar alanı yok. Git'te yalnız `.env.*.example` şablonları var.
- 3000 ve 3001'de oturumsuz `/api/data` ve `/api/users` **401**; `/.env`, `/.git/config`, DB, backend ve shared dosyası yolları **404**. API no-store, nosniff ve frame-ancestors kısıtı mevcut.
- Parametreli SQL, doğrulanan dinamik tablo/sütun kimlikleri, tipli LDAP filtreleri, üretimde HTTPS/DB sertifika doğrulaması, parola scrypt/hash doğrulaması, revision/CAS ve işlem atomikliği kaynak/test düzeyinde kontrol edildi.
- Aktivite kapsamı kullanıcı rolü ile genişletilmiyor; organizasyondaki Lider/PO/Team Member görevleri ve tarihsel takım kapsamı ilgili testlerde korunuyor. Yönetici rolünün ekran erişimi ile kişisel aktivite kapsamı birbirine karıştırılmadı.

## Mimari ve ölçek değerlendirmesi

1. Sayısal planlama komutlarında erken yetki/revision kontrolü ve delta yanıt yolu var. Buna rağmen `backend/store.mjs:448–484` başarılı yazmada snapshot okuma, kopya/doğrulama ve uyarı yeniden hesaplamasını sürdürüyor. Bu, veri büyüdükçe maliyet oluşturan bir tasarım noktasıdır; ölçümsüz bir yeniden yazım önerilmiyor.
2. MSSQL iş verisi yazmaları `backend/adapters/mssql.mjs:224–258` altında ortak Exclusive application lock ile seri ilerliyor; oturum ve giriş sayacı ayrı kilit alanları kullanıyor. Bu tutarlılık kararı çoklu yazıcı kapasitesini sınırlar. Gerçek kurum MSSQL gecikmesi ve kullanıcı eşzamanlılığı bu makinedeki SQL.js deneyiyle kanıtlanamaz.
3. Frontend ekranları ayrı JavaScript parçalarına ayrılmış ve kaynak/derleme hash envanteri var. CSS ise tek büyük dosyada; tema katmanları ve biriken override kuralları bakım maliyeti yaratıyor. P-01 önce ele alınmalı; kapsamlı CSS temizliği ayrı görsel regresyon işi olarak planlanmalı.
4. Kullanıcı manuelinin son ekran değişikliklerini tam kapsamaması bir dokümantasyon takibidir. Kullanıcının kaldırdığı açıklama satırları, hafta gösterim lejandı ve bekleyen değerlendirme bölümü eksik özellik/hata olarak sayılmadı.

### Sentetik yazma ölçümü

Tam arayüz paketi bittikten sonra, ayrı geçici SQL.js veritabanlarında; 200 kaynak, 1.000 takvim kaydı ve beşer tekrar kullanıldı. Üretim planlama komutu, tek doğrulama, sayısal snapshot kopyası ve delta yanıt yolu ölçüldü. HTTP/ağ süresi dahil değildir.

| Plan kaydı | Medyan uçtan uca süre | Örnek p95 | DB boyutu |
|---|---:|---:|---:|
| 1.000 | 20,91 ms | 23,90 ms | 700.416 bayt |
| 10.000 | 58,67 ms | 76,95 ms | 2.363.392 bayt |
| 50.000 | 221,85 ms | 229,96 ms | 10.067.968 bayt |

50.000 kayıtta okuma ve tam doğrulama belirgin maliyet oluşturuyor: ilgili aşama medyanları yaklaşık 102 ve 48 ms. Aşama ölçümleri örtüşebildiği için birbirine eklenmemeli. Beş örnekli p95, güvenilir bir üretim kuyruğu/kuyruk sonu kapasite tahmini değildir. Bu senaryoda çökme, veri bozulması veya belirlenmiş bir SLO ihlali doğrulanmadı; eşzamanlı gerçek kullanıcı ve MSSQL kabulü ayrı yapılmalı.

Komut:

```bash
node scripts/benchmark-store.mjs --sizes=1000,10000,50000 --samples=5 --resources=200 --calendar-days=1000 --response=delta --command=production --output=/tmp/aa-review-20261026-benchmark.json
```

## Testler ve kanıtlar

Yerel ortam: Node.js 24.21.0, npm 11.19.0, macOS ve Chrome. Test verileri sentetiktir.

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | **1.044 / 1.044**, format, tip ve üretim derlemesi başarılı |
| Geliştirme kök ve frontend `npm audit` | **0 bilinen açık** |
| 4.0.0 temiz klon kök `npm audit` | **0 bilinen açık** |
| Kaynak ve 4.0.0 dağıtım envanteri | Başarılı; 560 uygulama dosyasında fark yok |
| İzlenen sır denetimi | Desen denetimi başarılı; S-01 ayrıca doğrulandı |
| Önceki bulguların yeniden üretimi | **3 / 3**, tarayıcı JavaScript hata listesi boş |
| Yeni aksiyon taslağı yeniden üretimi | Üç alan kaybı ve onaysız geçiş doğrulandı |
| Tam izole tarayıcı paketi | **334 kontrol başarılı**, tüm fixture toplamı; süreç çıkışı 0 |
| Sentetik performans deneyi | 1.000 / 10.000 / 50.000 plan kaydı; beşer örnek, sonuçlar aşağıda |
| Yerel HTTP / statik dosya erişimi | İki port sağlıklı; korunan veri 401, hassas dosya yolları 404 |
| Gerçek MSSQL / Windows / kurum AD, proxy ve üretim yükü | Bu yerel turda çalıştırılmadı |

Geçici kanıtlar `tmp/review-2026-10-26/` altında, test günlükleri `/tmp/aa-review-20261026-*` dosyalarında. Kimlik bilgisi kanıtında yalnız eşleşme/aktiflik bayrakları var; gerçek parola yok. Bu dosyalar Git'e eklenmez.

**Düzeltme sırası:** S-01 parola/oturum güvenliği; S-02 kota yaşam döngüsü; L-01 ve L-02 taslak koruması; U-01 kapatma davranışı; P-01 aktarım optimizasyonu. Güncel kapanış durumu ve kabul kontrolleri yukarıdaki düzeltme bölümündedir. Her düzeltme ayrı yeniden üretim/kabul kontrolüyle doğrulanmalı.
