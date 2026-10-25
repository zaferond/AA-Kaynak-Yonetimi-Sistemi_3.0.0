# Güvenlik, mimari ve hata incelemesi — 24.10.2026

İncelenen sürüm: `main`, `9cd94ba4a60f3d30b350375d5b890eb46091d360`.

**25.10.2026 güncellemesi:** Aşağıdaki metin inceleme anının tarihsel kaydıdır. Kod düzeltmeleri, güncel test sonuçları ve kalan ortam kabulleri [düzeltme raporunda](duzeltme-ve-dogrulama-raporu-2026-10-25.md) izlenir.

## Karar

Temel yetkilendirme ve veri bütünlüğü kontrolleri güçlü; geniş bir yeniden yazım gerekmiyor. Bununla birlikte bu sürüm için güvenlik ve yayın kabulü tamamlanmış sayılamaz. Öncelik, aşağıdaki süreç kapatma açığını gidermek, hesaplar arasında kalan tarayıcı taslaklarını ayırmak ve aynı commit üzerinde başarısız olan CI kontrollerini kapatmaktır.

Bu çalışma inceleme ve doğrulamadır. Uygulama kodu, bağımlılıklar, gerçek veritabanları ve çalışan 3000/3001 uygulamaları değiştirilmedi. Yalnız bu rapor eklendi. Derlemenin değiştirdiği manifest, kaynak/çıktı karmalarının eşitliği doğrulanarak başlangıçtaki haline getirildi.

## Bulgular ve yapılacak işler

Öncelikler: **P1** yayın öncesi kapatılmalı; **P2** sıradaki düzeltme/kabul işleri; **P3** ölçüme bağlı iyileştirme.

### 1. P1 — Oturum açmadan sunucu sürecini kapatabilen body-parser açığı

**Durum: gerçek uygulama koduyla, ayrı süreçte doğrulandı.**

- Kurulu `body-parser` sürümü `2.3.0`; Express üzerinden geliyor (`package-lock.json:387`).
- `backend/app.mjs:204` giriş gövdesini, `backend/app.mjs:323` ve `:324` diğer gövdeleri varsayılan sıkıştırma açma davranışıyla ayrıştırıyor.
- Veritabanına bağlanmayan ayrı bir çocuk süreçte gerçek `createApp` çalıştırıldı. Sentetik giriş verisini taşıyan geçerli gzip çerçevesi ve devamındaki baytlarla gönderilen tek istek, `Gunzip` üzerinde yakalanmayan `Z_DATA_ERROR / incorrect header check` üretti. Çocuk süreç **çıkış kodu 1** ile kapandı; istemci `ECONNRESET` aldı. Gerçek kullanıcı hesabı veya başarılı oturum gerekmedi.
- İlk basit gzip denemesi 400 döndürmüştü; süreç kapanması daha sonra üreticinin regresyon örneğindeki çerçeve yapısıyla doğrulandı. Her bozuk gzip isteğinin süreci kapattığı iddia edilmiyor.
- Origin/Host kontrolü ve giriş sınırı mevcut. Bunlar doğrudan HTTP istemcisinin uygun başlıklarla gönderebildiği tek isteğe karşı bu ayrıştırıcı hatasını ortadan kaldırmıyor.

**İş:** Express bağımlılık zincirini `body-parser >=2.4.0` içerecek şekilde güncellemek. Sıkıştırılmış JSON yüklemeye iş ihtiyacı yoksa tüm JSON ayrıştırıcılarında `inflate: false` ek savunma olabilir. Global `uncaughtException` ile hatayı yutmak çözüm olarak kullanılmamalı.

**Kabul:** Aynı istek kontrollü HTTP yanıtıyla reddedilmeli; süreç açık kalmalı ve ardından normal sağlık/giriş isteğine yanıt vermeli. Kilit dosyası, güvenlik taraması ve giriş regresyonları doğrulanmalı.

Kaynak: [üreticinin güvenlik duyurusu, GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), [üreticinin düzeltmesi ve regresyon örnekleri](https://github.com/expressjs/body-parser/commit/f7075ea).

### 2. P1 — Güncel commit yayın kabulünden geçmiyor

**Durum: GitHub Actions sonucu doğrulandı; hata kök nedenleri henüz doğrulanmadı.**

Tam olarak incelenen commit'in [Quality checks koşusu](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/actions/runs/40122640163) sonuçları:

| İş | Sonuç | Başarısız adım |
|---|---|---|
| verify | Başarısız | Browser security and draft regression checks (synthetic database) |
| windows-synthetic | Başarılı | — |
| native-mssql / native | Başarısız | Run native assertions and synthetic SQL profile |
| Release acceptance | Başarısız | Üç doğrulamanın aynı commit'te başarılı olmasını isteyen kapı |

İş/adım sonuçları public GitHub API'den okundu. Ayrıntılı iş günlüklerini indirme isteği 403 döndüğü için native hatanın uygulama, test beklentisi veya altyapı kaynaklı olduğu söylenemez. SQL.js testlerinin geçmesi MSSQL kabulü değildir. Bu makinede Docker bulunmadığından native SQL Server koşusu ayrıca çalıştırılmadı.

Bu incelemede yerel tam izole tarayıcı paketi sonuna kadar **başarılı** tamamlandı. Bu sonuç, CI'deki tarayıcı hatasının yerelde tekrarlanmadığını gösteriyor; CI hatasının nedenini açıklamıyor. Yerel sonuç ile Linux CI ortamı/günlüğü karşılaştırılmalı; test doğrudan atlanarak kapatılmamalı.

**İş:** İlgili koşunun ayrıntılı günlüklerinden iki hatayı ayırmak; düzeltmelerden sonra tarayıcı, native MSSQL, Windows ve release acceptance kontrollerini aynı son commit'te geçirmek. Bağımlılık audit adımları da çalışıp geçmeli; bu koşuda verify daha önce tarayıcı adımında duruyor.

**Kabul:** Aynı commit için tüm zorunlu işler yeşil olmalı; native kanıtın kaynak karmaları o commit ile eşleşmeli. Eski commit'lerin başarılı kanıtları yeni sürümün kabulü sayılmamalı.

### 3. P2 — Kaydedilmemiş senaryo taslakları başka hesaba taşınıyor

**Durum: izole tarayıcıda, gerçek çıkış/giriş akışıyla doğrulandı.**

- `frontend/src/features/schedule-scenario/useScheduleScenarios.ts:16` ve `:17`, `aa.scenarioCards` / `aa.scenarioCompared` anahtarlarını tüm hesaplar için ortak kullanıyor.
- Hook kullanıcı kimliği almıyor; `:63` ve sonrasında yeni çalışma alanı bu veriyi tekrar okuyor.
- `frontend/src/storage.ts:232` çıkışta sunucu oturumunu ve bellek durumunu temizliyor; bu iki depolama anahtarı temizlenmiyor.
- Sentetik root-admin hesabında senaryo adı değiştirildi ve kaydedilmedi. Aynı sekmede Çıkış yapılıp `manager` hesabıyla girildi. Proje Takvimi Güncelle ekranındaki senaryo adı önceki hesabın taslak adı olarak kaldı.

**Etki:** Aynı sekmeyi kullanan hesaplar arasında taslak adı, seçili proje kimlikleri, kaydırma ayları ve karşılaştırma seçimleri karışabilir. Sunucudaki kayıt yetkilerinin aşıldığı veya diğer hesabın tüm proje verilerine erişildiği doğrulanmadı; sorun istemci taslağının izolasyonudur. `sessionStorage` sekme kapatılınca biter, fakat uygulamadan çıkışta kendiliğinden temizlenmez.

**İş:** Depolama anahtarlarını doğrulanmış kullanıcı kimliğiyle ayırmak ve eski ortak anahtarları güvenli biçimde temizlemek. Hesap değişimi sırasında hook durumunu da sıfırlamak.

**Kabul:** A → çıkış → B girişinde B, A'nın taslağını görmemeli. A'nın aynı hesapta sayfa yenileme davranışı korunmalı; hesap değişimi, oturum süresi dolması ve diğer sekmeden hesap değişimi test edilmeli.

### 4. P2 — Ay geçişindeki Aktivite Giriş okuması kayıtlı değeri sıfır gösterebiliyor

**Durum: geçici SQL.js veritabanı ve kontrollü saatle doğrulandı.**

- `backend/store.mjs:215` içindeki `actualView`, veri okuma ve son görünüm üretiminde ayrı varsayılan tarihler kullanıyor.
- `backend/actual-report-reader.mjs:48`, `actualViewResources` çağrısına okuyucunun aldığı `date` değerini de iletmiyor.
- Buna karşılık `Store.activityReport` aynı referans tarihini zaten taşıyor (`backend/store.mjs:235`); önceki Aktivite Raporu düzeltmesi doğru ve kapalı kalıyor.

**Yeniden üretim:** Sentetik Kasım kaydı `0.2` olarak kaydedildi. Saat İstanbul'da 31 Ekim 23:59:59 iken Ekim–Kasım görünümü istendi; sayısal kayıt okumasından sonra saat 1 Kasım 00:00:01'e alındı. İlk yanıt Kasım özetini `projectFte: 0` üretti ve kayıt haritasında Kasım değerini içermedi. Aynı sorgunun yenilenmiş yanıtı kayıtlı `0.2` değerini getirdi.

**Etki:** Kayıt kaybı değil, ay sınırını geçen tek istekte tutarsız görüntü. Organizasyon görevi o ay değişiyorsa kişi kapsamının da farklı tarihlerle hesaplanma riski var; bunun ayrı veri sızıntısı yarattığı bu çalışmada doğrulanmadı.

**İş:** İstek/Store okuması başında tarihi bir kez almak; okuyucuya, kaynak kapsamına ve son projeksiyona aynı tarihi geçirmek. `scopeData` içindeki zamana bağlı kontroller de aynı referansla değerlendirilmelidir.

**Kabul:** Ay sınırını geçen istek tutarlı biçimde tek aya/tarihe dayanmalı; sonraki istekte yeni ay açılmalı. PO/takım görevi değişimi ve ay sonunda işe başlayan kişi de kapsanmalı.

### 5. P2 — Zod için yüksek önem dereceli bağımlılık uyarısı

**Durum: etkilenen sürüm kurulu; uygulamaya karşı bellek tüketme saldırısı denenmedi.**

Hem sunucu hem ön yüzde `zod 3.25.76` var (`package-lock.json:1798`, `frontend/package-lock.json:2742`). Güncel duyuru aşırı büyük/geçersiz koleksiyonların doğrulanmasında bellek tüketimini bildiriyor; düzeltilmiş sürüm `4.6.6` ve sonrası.

Sunucuda 2 MB/20 MB gövde sınırları, kimlik doğrulama ve mutasyon kabul sınırları maruziyeti azaltıyor. Bununla birlikte `backend/operations.mjs:48` büyük değişiklik listelerini ayrıştırıyor; `shared/snapshot-schema.ts:344` ve sonrasında bazı koleksiyonlar eleman sayısı sınırı olmadan tanımlı. Gerçek sunucu üzerinde bellek tükenmesi testi yapılmadı; bu madde doğrulanmış süreç kapatma bulgusu olan #1 ile aynı kanıt seviyesinde değildir.

Sınırlı bir yerel ölçümde, veritabanı kullanmadan gerçek `stageChanges` ayrıştırıcısına 5000 boş nesne verildi: 15.001 baytlık girdi için 15.000 doğrulama hatası oluştu; tek ölçümde yaklaşık 6 MB ek heap ve 22 ms görüldü. Bu, hata birikmesini gösterir; bellek tükenmesinin veya üretim gecikmesinin kanıtı değildir. Daha büyük saldırı yükü denenmedi.

**İş:** Sunucu ve ön yüzde Zod 4 geçişini kontrollü yapmak; şema, hata yanıtı ve TypeScript uyumunu doğrulamak. Büyük koleksiyonlarda ayrıştırma öncesi eleman sayısı ve toplam iş yükü sınırlarını değerlendirmek. `npm audit fix --force` ile körlemesine major güncelleme yapılmamalı.

**Kabul:** İki audit bu uyarıdan temizlenmeli; tüm şema/restore/import testleri geçmeli. Sınırı aşan sentetik koleksiyon kontrollü biçimde, sınırsız hata nesnesi oluşturmadan reddedilmeli.

Kaynak: [Zod güvenlik duyurusu, GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

### 6. P2 — MSSQL zincirindeki Azure/MSAL bağımlılık uyarısı

**Durum: etkilenen geçişli paket kurulu; ilgili auth-code akışının kullanıldığı görülmedi.**

Zincir: `mssql → tedious → @azure/identity 4.13.3 → @azure/msal-node 6.0.1`. Duyurunun düzeltilmiş MSAL sürümü `7.1.0`.

Uygulama `backend/adapters/mssql.mjs:23` üzerinden SQL/NTLM bağlantısına izin veriyor; kullanıcı AD girişi ayrı LDAP/LDAPS akışında. Duyurunun etkilediği MSAL authorization-code akışı uygulamada bulunmadı. Bu nedenle mevcut AD parolalarının sızdığı veya bu açığın mevcut yapılandırmada uzaktan kullanılabildiği sonucu çıkarılmıyor.

**İş:** MSSQL/Tedious/Azure bağımlılıklarını uyumlu ve yamalı zincire taşımak; özellikle mevcut Tedious override'ını gözden geçirmek. Sonrasında native SQL/NTLM ve bağlantı/TLS testlerini çalıştırmak.

**Kabul:** Audit uyarısı kalkmalı ve native MSSQL kanıtı yeni kilit dosyasıyla üretilmeli.

Kaynak: [MSAL güvenlik duyurusu, GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5).

## Mimari değerlendirme ve operasyon işleri

### Korunması gereken mevcut yapı

- Yetki kontrolleri sunucuda uygulanıyor. Uygulama rolü ile çalışanın organizasyon görevi ayrılmış; `manager` rolü aktivite kapsamını kendiliğinden genişletmiyor. Takım geçmişi raporlarının ay bazında değerlendirilmesi korunuyor.
- Oturum kimliği veritabanında özetleniyor; parolalar scrypt ile tutuluyor. Hesap sürümü/aktifliği isteklerde yeniden kontrol ediliyor. CSRF, Origin/Host, güvenli çerez, CSP ve üretim TLS kontrolleri mevcut.
- SQL değerleri parametreleniyor; tablo/sütun seçimleri kontrollü kataloglardan geliyor. Yazma, revizyon denetimi ve audit aynı transaction içinde. SQL.js süreç kilidi, disk yazma hatasında geri alma ve MSSQL uygulama kilitleri var.
- Büyük gövdeler ve eşzamanlı mutasyon/rapor okumaları sınırlandırılmış. Aktivite/rapor okumaları tüm planlama verisini çekmek yerine ayrı okuma modelleri kullanıyor.
- Excel içe aktarmada sıkıştırılmış/açılmış boyut sınırları, XML/DTD reddi ve dış ilişki denetimi; dışa aktarmada metnin formüle dönüşmesini engelleyen yazım mevcut.
- Yayın paketi kaynak ve çıktı karmalarını doğruluyor. Temiz paket kabulü gerçek veri, `.env` ve tarihsel çıktıları dışlıyor.

İncelenen akışlarda bunlara ek doğrulanmış SQL injection, XSS veya sunucu rolü aşımı bulunmadı. Bu sonuç bağımsız sızma testi, gerçek kurum ağı/AD/proxy doğrulaması veya tüm olası saldırıların yokluğu anlamına gelmez.

### Takip edilecek mimari/operasyon işleri

| İş | Öncelik | Somut tamamlanma ölçütü |
|---|---|---|
| Başarısız CI kanıtlarını saklamak | P2 | Tarayıcı `result.json`, ekran görüntüleri ve native hata günlükleri temizlenmeden önce `if: always()` ile artifact olarak yüklenmeli. `quality.yml` şu an tarayıcı artifact yüklemiyor; native artifact adımı önceki adım hata verince atlanıyor. Sentetik veriler kullanılmalı; sırlar maskelenmeli. |
| Kurum ortamında yedekten dönüş tatbikatı | P2, yayın öncesi operasyon | Mevcut `VERI-SAKLAMA-VE-YEDEKLEME.md` prosedürüyle ayrı DB'ye dönüş, integrity/DBCC, giriş, rol, planlama ve geçmiş kontrolleri; süre ve sonuç kaydı. Yedek araçlarının otomatik testleri bu tatbikatın yerine geçmez. Bu incelemede gerçek yedek zamanlayıcısı/kurum deposu doğrulanmadı. |
| Gerçek proxy/LDAPS ve servis izleme kabulü | P2, ortam bağımlı | Kurumsal sertifika zinciri, trusted proxy listesi, Node portuna doğrudan erişim kısıtı, servis yeniden başlatma ve sağlık alarmı kurum ortamında denenmeli. Yerel SQL.js kullanımı tek başına hata değildir; production kodu zaten MSSQL/TLS şartlarını denetliyor. |
| Büyük veri altında mutasyon maliyetini ölçmek | P3 | `backend/store.mjs:463` sonrasında her başarılı yazma hâlâ tam snapshot doğrulamasından geçiyor; MSSQL yazmaları genel exclusive kilidi paylaşıyor. Native profilde büyüyen veri ve eşzamanlı isteklerle lock/read/validate/persist süreleri ölçülmeli. Hedef aşılırsa ölçülen darboğaza göre komut bazında doğrulama/okuma ayrıştırılmalı; mevcut atomiklik korunmalı. Bu turda üretim ölçeğinde gecikme kanıtı toplanmadı. |

## Doğrulama sonuçları

| Kontrol | Bu incelemedeki sonuç |
|---|---|
| `npm run verify` | Başarılı: biçim kontrolü, **1022/1022 test**, TypeScript ve üretim derlemesi; başarısız/atlanan test yok |
| `npm run deploy:verify` | Başarılı: kaynak/çıktı farkları boş, `ok: true` |
| `node scripts/check-deployment-package.mjs` | Başarılı: 650 kaynak, 72 çıktı; 1481 tarihsel çıktı paketten dışlanmış |
| Kök `npm audit` | **4 high**, critical/moderate/low yok |
| Ön yüz `npm audit` | **1 high**, diğer seviyeler yok |
| `node scripts/run-browser-checks-isolated.mjs` | **Başarılı, çıkış kodu 0.** Normal risk görünürlüğü ve izole risk açık derlemedeki tam paket tamamlandı; günlükte toplam **308 PASS** kaydı var. Sondaki JSON'daki `checks: 180` yalnız son ortak fixture'ın sayısıdır; önceki ayrı fixture'ları içermez. |
| body-parser süreç kapanması | Veritabanısız ayrı süreçte doğrulandı |
| Aktivite Giriş ay geçişi | Geçici sentetik DB ve kontrollü saatle doğrulandı |
| Hesaplar arası senaryo taslağı | İzole tarayıcıda gerçek çıkış/girişle doğrulandı |
| Native MSSQL | Yerelde çalıştırılmadı; aynı commit'in CI işi başarısız |
| Windows | Aynı commit'in GitHub CI işi başarılı; bu makinede ayrıca çalıştırılmadı |

Audit'teki 4+1 paket kaydı **beş ayrı açık anlamına gelmez**: Zod iki ağaçta yineleniyor; Azure identity ve MSAL aynı geçişli güvenlik uyarısının parçaları. Toplam **üç farklı güvenlik duyurusu** var. Paket taraması ve kod/test incelemesi birbirinin yerine geçmez.

Önceki `test-kalite-raporu-2026-10-24.md` dosyasındaki tam UI koşusu eksiği bu yerel doğrulamayla kapandı. Native MSSQL ve aynı commit üzerinde yeşil CI/yayın kabulü eksiği sürüyor. Burada doğrulanan #3 ve #4, mevcut testlerin yakalamadığı ek senaryolardır.

Yerel çalışma günlükleri: `/tmp/aa-review-2026-10-24-verify.log`, `/tmp/aa-review-2026-10-24-browser.log`, `/tmp/aa-review-2026-10-24-package.log`; audit JSON'ları aynı önekle `root-audit.json` ve `frontend-audit.json`. Bunlar geçici yerel kanıtlardır, Git deposuna eklenmedi.

## Önerilen uygulama sırası

1. #1 body-parser düzeltmesi ve süreç açık kalma regresyonu.
2. #3 hesap bazında senaryo taslak izolasyonu ve #4 tek tarihli Aktivite Giriş okuması.
3. #5 Zod geçişi ve #6 MSSQL/Azure bağımlılık zincirinin güncellenmesi.
4. #2 kapsamındaki tarayıcı/native CI hatalarının günlüklerle çözülmesi; tüm kontrollerin aynı son commit'te yeşile dönmesi.
5. Kurum ortamında yedekten dönüş, proxy/LDAPS ve izleme kabulü. Büyük veri optimizasyonu ancak ölçüm gerekli gösterirse ayrı geliştirme olarak ele alınmalı.
