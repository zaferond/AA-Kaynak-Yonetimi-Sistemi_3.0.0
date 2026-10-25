# API, sır yönetimi, güvenlik, mimari ve arayüz incelemesi — 25.10.2026

**Düzeltme güncellemesi:** Bu incelemede bulunan beş maddeye yapılan değişiklikler, oturum politikası, yerel veritabanı geçişi ve güncel test sonuçları [beş bulgu düzeltme raporunda](bes-bulgu-duzeltme-2026-10-25.md) yer alır. Aşağıdaki bulgu metinleri inceleme anının kaydıdır.

İncelenen durum: `main / 9cd94ba` üzerine önceki düzeltme turunun yerel değişiklikleri. Bu çalışma yeniden incelemedir; aşağıdaki yeni bulgular için uygulama kodu değiştirilmedi. İstenen 3001 demo sunucusu ayrıca başlatıldı.

Önceki düzeltmeler ve 309 kontrolün tamamlandığı tarayıcı koşusu [düzeltme raporunda](duzeltme-ve-dogrulama-raporu-2026-10-25.md). Yeni bulgular farklı senaryolara aittir; önceki body-parser, hesaplar arası taslak gösterimi ve ay sınırı düzeltmelerinin geri bozulduğu görülmedi.

## API anahtarı gerekiyor mu, şu anda açık var mı?

**Mevcut uygulama genel bir API anahtarı kullanmıyor ve tarayıcının çalışması için böyle bir anahtara ihtiyacı yok.** Kullanıcı girişiyle üretilen sunucu oturumu, HttpOnly çerez ve POST işlemlerinde CSRF doğrulaması kullanılıyor. Kodda OpenAI, ödeme, bulut vb. harici servis için etkin bir API anahtarı entegrasyonu bulunmadı. `.env` dosyasına rastgele `API_KEY` veya `JWT_SECRET` eklemek mevcut uçları korumaz; bu isimleri kullanan bir doğrulama yolu yok.

Mevcut yapı:

| Bilgi | Nerede bulunuyor / nasıl korunuyor? |
|---|---|
| Kullanıcı parolası | Sunucuda scrypt özeti ve rastgele salt; tarayıcıya parola özeti dönmüyor (`backend/auth.mjs`) |
| Oturum kimliği | `randomBytes(32)` ile üretiliyor; DB'de SHA-256 özeti tutuluyor; tarayıcıda HttpOnly ve SameSite=Strict çerez (`backend/app.mjs:159`, `:249`) |
| CSRF belirteci | Oturuma bağlı ayrı rastgele değer; istemci belleğinde tutulup yazma isteği başlığıyla gönderiliyor. Genel API anahtarı değildir. |
| SQL/AD servis parolaları | Sunucunun ortam ayarları; tarayıcı kodunun ihtiyacı yok. AD etkinse LDAPS ve sertifika doğrulaması var. |
| İlk yönetici parolası | Bootstrap/reset için ortam değişkeni. İlk girişte uygulama içinde değiştirme zorunluluğu var; mevcut hesap her yeniden başlatmada `.env` parolasına dönmüyor. |

**Bu incelemede gerçek bir anahtar/parola sızıntısı doğrulanmadı.** Kontroller:

- Git ile izlenen 997 metin dosyasında yaygın GitHub, AWS, sağlayıcı API anahtarı ve özel anahtar kalıpları tarandı; eşleşme yok.
- `site/assets` altındaki 1591 dosyada yerel `.env` sırlarının birebir bulunup bulunmadığı kontrol edildi; eşleşme yok. Değerler çıktıya/rapora yazılmadı.
- Gerçek `.env` ve `.env.demo` Git'te izlenmiyor; yerel dosya izinleri `0600`.
- İzlenen `.env.mssql` boş. Örnek dosyalardaki parola alanları açıklayıcı yer tutucu/test değerleri; gerçek kurumsal parola olduklarına dair kanıt yok.
- Yaygın gerçek ayar adları `.env`, `.env.demo`, `.env.local`, `.env.production` için mevcut yerel Git geçmişinde commit kaydı bulunmadı. Bu, bütün geçmiş blob'larının ve bütün olası sır biçimlerinin adli taraması değildir.
- 3000 ve 3001'de oturumsuz `/api/data` → **401**; `/.env`, `/data/planlama.sqlite`, `/backend/auth.mjs` → **404**; sağlık uçları → **200**.
- Tarayıcı derlemesindeki açık `define` alanları yalnız ortam türü ve risk görünürlüğü bayrağı. Gerçek SQL/AD sırlarının build'e aktarımı görülmedi.

Desen ve birebir değer taraması, kodlanmış/gizlenmiş her sırrın yokluğunu ispatlamaz. Canlı kurum ortamının secret deposu, proxy günlükleri ve yedeklerine erişilmedi.

## Yeni bulgular

### 1. P2 — Değerlendirme ekranında uzak güncelleme kaydedilmemiş taslağı silebiliyor

**Kanıt: izole tarayıcı + geçici sentetik DB ile yeniden üretildi.**

- `frontend/src/features/project-progress/ProgressCard.tsx:119` içindeki effect, `[month, revision, locked]` değiştiğinde yüzde/not alanını sunucudaki değerden yeniden kuruyor; `:129` ve sonrasındaki effect hedef plan formunu da revision ile yeniliyor.
- `frontend/src/App.tsx:361` arka plan yenilemesini modal/dizin/hesap/risk düzenlemesine göre durduruyor. ProgressCard'ın kirli form durumu bu kapsama kayıtlı değil. `usePortalRefresh` yalnız alanın odakta olmasını da kontrol ediyor; kullanıcı alan dışına tıklayınca bu koruma bitiyor.
- Sentetik onaylı hedef plan açıldı, Eylül gerçekleşen alanına **37** yazıldı ve kaydedilmedi. Başka bir işlem aynı kayda **25** kaydetti. Alan odağı dışarıdayken dış değişiklik bildirimiyle snapshot yenilendi. Sonuç: 37 taslağının alanı uyarısız kaldırıldı, DB'de 25 kaldı.

**Etki:** Kullanıcının kaydedilmemiş emeği kayboluyor. Sunucuda 37 kaydı silinmiş değildir; o değer hiç gönderilmemişti. Yetki aşımı doğrulanmadı.

**İş:** Hedef/gerçekleşen taslaklarının kirli durumunu yenileme ve gezinme korumasına katmak; açılış revision'ını sabit tutmak. Uzak değişiklikte taslağı koruyup çakışma göstermek; Kaydet/Vazgeç kararını kullanıcıya bırakmak. Ay değişimindeki mevcut ürün davranışı bu ayrı sorunun çözümüyle karıştırılmamalı.

**Kabul:** Aynı senaryoda 37 taslağı görünür kalmalı; açıkça onaylanmadan 25 ile değiştirilmemeli veya yeni revision'a sessizce taşınmamalı. Kaydet/Vazgeç, uzaktan kilitleme ve hedef plan taslağı da sınanmalı.

### 2. P2 — Sayısal olmayan büyük sözlüklerde doğrulama hata bütçesi eksik

**Kanıt: sınırlı, DB kullanmayan ölçüm. Süreç/bellek tükenmesi denenmedi.**

- Sayısal sözlükler önceki turda sınırlandı; `shared/numeric-record-schema.ts` büyük geçersiz haritaları erken reddediyor.
- Buna karşılık `shared/snapshot-schema.ts` içindeki `workCalendar` / `personCalendar` ve `backend/actual-calendar-commands.mjs:36` içindeki takvim sözlüğü Zod record üzerinden bütün hataları biriktirebiliyor. Dizi erken kesme seçeneği bu record davranışını değiştirmiyor.
- 5000 geçersiz takvim kaydı içeren **113.891 baytlık** sentetik girdide **5000 issue**, tek ölçümde yaklaşık **3 MB ek heap / 20 ms** oluştu. Daha büyük yük denenmedi. Bu ölçümden üretim gecikmesi ya da kesin OOM sonucu çıkarılamaz.

**Maruziyet:** Ortak takvim/restore yolları yönetici yetkisi gerektiriyor; oturumsuz giriş yolu değildir. Gövde ve mutasyon kabul sınırları mevcut. Yine de hatalı büyük yönetici dosyası/isteği gereksiz bellek ve genel yazma kilidi süresi tüketebilir.

**İş:** Büyük record doğrulamalarına da toplam kayıt/hata bütçesi veya ilk bozuk kayıtta durma eklemek; geçerli büyük veriyi rastgele düşürmeden kabul edilen sınırları tanımlamak. Anahtar biçimini de erken denetlemek.

**Kabul:** Aynı ve daha büyük sınırlı sentetik takvim girdileri sabit/sınırlı hata sayısıyla reddedilmeli; geçerli takvim, yedek ve geri dönüş davranışı korunmalı. `npm audit` sonucunun sıfır olması bu uygulama düzeyindeki boşluğu kapatmaz.

### 3. P2 — İlk yönetici parolası politikası, yeni parola politikasından daha gevşek

**Kanıt: gerçek yardımcı fonksiyonlarda sentetik değerlerle doğrulandı.**

- `backend/admin-credentials.mjs:17` içindeki `assertAdminPassword` boş/yer tutucu/kullanıcı adına eşit parolayı reddediyor; yeni parola gücü denetimi ayrı `assertNewPasswordStrength` fonksiyonunda.
- `backend/setup.mjs` ve ilk hesap oluşturma yolu `assertAdminPassword` + 10 karakterlik uzunluk sınırına dayanıyor.
- Tekrarlanan harfler, yalnız tekrarlanan semboller ve azalan rakamlardan oluşan **10 karakterlik** üç sentetik değer bootstrap kontrolünden geçti; aynı değerler yeni parola kontrolünden geçmedi.

**Etki:** İlk kurulum veya CLI reset sırasında tahmin edilebilir geçici yönetici parolası seçilebilir. İlk girişte parola değiştirme zorunluluğu var; ancak geçici parolayı bilen biri ilk girişi yaparsa bu zorunluluk hesabı korumaz. Mevcut gerçek parolanın zayıf olduğu veya hesabın ele geçirildiği iddia edilmiyor.

**İş:** Bootstrap, CLI reset ve uygulama içi yeni parola için tutarlı güç denetimi; tercihen kurulumda güçlü, benzersiz geçici parola üretimi. İlk hesabı ağ erişimine açmadan güvenli kurulum prosedürü.

**Kabul:** Aynı zayıf sentetik örnekler setup/reset yolunda da reddedilmeli; başlatmada var olan kullanıcının parolası kendiliğinden değiştirilmemeli.

### 4. P2 — Sır içerebilecek ortam dosyalarının Git koruması eksik/yerel

**Kanıt: Git indeks ve ignore kaynağı kontrolü. Şu anda bu dosyalarda gerçek sır yayını doğrulanmadı.**

- `.gitignore:2` yalnız `.env` adını, `:3` yalnız `.env.mssql.test` adını koruyor.
- `.env.demo`, depoyla paylaşılmayan `.git/info/exclude:7` sayesinde bu bilgisayarda gizleniyor. Yeni bir klonda aynı koruma garanti değil.
- Boş `.env.mssql` **Git ile izleniyor**. Doldurulursa normal commit'e girebilir; sonradan ignore eklemek izlenen dosyayı kendiliğinden kapsam dışına çıkarmaz.

**İş:** Gerçek `.env*` çeşitlerini paylaşılan ignore kuralıyla koruyup yalnız yer tutucu `*.example` dosyalarını istisna tutmak. Kullanılmayan boş gerçek ayar dosyasını indeksten çıkarmak veya açık bir örnek adına taşımak. CI/pre-commit sır taraması eklemek.

**Kabul:** Temiz klonda `.env.demo`, `.env.local`, `.env.production`, `.env.mssql` commit adayı olmamalı; örnekler izlenebilir kalmalı. Gerçek sır bulunursa önce iptal/yenileme yapılmalı; yalnız dosyayı silmek yeterli sayılmamalı.

### 5. P2 — Ayrı hareketsizlik zaman aşımı yok; yöneticiye de 30 gün “Beni Hatırla” uygulanabiliyor

**Kanıt: sunucu oturum oluşturma/okuma yolu ve şema incelemesi. Bu bir mevcut hesap ele geçirme kanıtı değildir.**

- `backend/app.mjs:249` ve sonrasında LDAP için 12 saat, yerel hesap için normalde 12 saat / hatırla ile 30 gün mutlak ömür var; yönetici için daha kısa ayrı politika yok.
- `backend/identity-repository.mjs:120` oturumun yalnız `expires_at` değerini kontrol ediyor. Sunucuda son kullanıcı etkinliği/idle sınırı alanı yok.

**Etki:** Açık bırakılan ortak bilgisayarda oturum uzun süre kullanılabilir. Mevcut aktiflik/hesap sürümü kontrolü, logout ve yetki değişiminde iptal korumaları çalışıyor; bu bulgu onların yokluğu anlamına gelmiyor.

**İş:** Kurumun kabul ettiği, sunucuda uygulanan idle + mutlak süre politikası; yüksek yetkili hesaplarda kalıcı oturumun ayrıca sınırlandırılması. 15 saniyelik arka plan sürüm sorguları kullanıcı etkinliği sayılıp oturumu sonsuza dek açık tutmamalı. Süre dolmadan kullanıcı uyarılmalı ve taslak kaybı ele alınmalı.

**Kabul:** Kullanıcı etkileşimi durduğunda sunucu oturumu belirlenen sürede reddetmeli; arka plan sorguları bunu uzatmamalı. Aktif çalışma ve başarısız geçici ağ denetimi gereksiz çıkış yaratmamalı.

Rehber: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Önerilecek süre kurumun risk ve kullanım kararına bağlıdır; bu inceleme kendiliğinden yeni süre uygulamadı.

## API anahtarları ileride eklenecekse

İnsanların tarayıcı oturumu için ortak, sabit bir anahtar eklenmemeli. Sunucular arası entegrasyon gerekirse önerilen tasarım:

- Her entegrasyona ayrı kimlik ve kriptografik rastgele sır; sır yalnız oluşturulurken gösterilmeli, DB'de geri okunabilir hali yerine doğrulama özeti tutulmalı.
- Okuma/yazma, takım/proje ve uç bazında açık kapsam; ortak `admin` anahtarı kullanılmamalı. Kullanıcı API'sinin mevcut sunucu yetki denetimleri korunmalı.
- Süre, iptal, yenileme, oran sınırı ve kullanım kaydı; sır URL/query, log, Git, ön yüz kodu veya tarayıcı depolamasına konmamalı.
- Üretimde HTTPS; sunucu sırları için kurum secret deposu veya erişimi kısıtlı servis ortamı. SQL runtime ve migration hesapları ayrılmalı; AD servis hesabı ihtiyaç duyduğu okuma/bind yetkileriyle sınırlanmalı.

Bu tasarım şu anda varmış gibi bir API anahtarı üretilmedi. Rehberler: [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

## Mimari ve kullanım açısından diğer takipler

- Zod core erken-kesme seçeneği ve MSAL override sürüme bağlı bakım noktaları olarak duruyor; sürümler sabit/lock ile kontrollü ve regresyonları var. Sonraki güncellemede bu sözleşmeler yeniden sınanmalı.
- Başarılı mutasyonlar tam snapshot doğrulaması ve MSSQL genel yazma kilidi kullanmaya devam ediyor. Üretim ölçeği/çoklu kullanıcı profili ölçülmeden geniş bir yeniden yazım veya kapasite garantisi önerilmiyor.
- Hesaplara ayrılmış senaryo taslakları uygulama ekranında birbirine karışmıyor. Fakat aynı tarayıcı profilinin yerel depolamasına erişebilen biri için anahtar adının kullanıcı kimliği içermesi şifreleme değildir. Gerçek ortak/kiosk bilgisayar senaryosunda çıkışta taslak temizleme veya yeniden doğrulama politikası ayrıca değerlendirilmeli.
- AD/LDAPS kullanıcı parolası kontrolü tek başına OIDC/SSO/MFA değildir. İnternet erişimi veya yüksek yetkili kurumsal kullanım hedefleniyorsa kurum kimlik sağlayıcısı/MFA kabulü ayrı tasarlanmalı; mevcut LDAP'ın bunu kendiliğinden sağladığı varsayılmamalı.
- Yedekten dönüş tatbikatı, kurum TLS/proxy/LDAPS bağlantıları ve gerçek MSSQL/Windows kabulü hâlâ ortamda doğrulanmalı. Ayrı portlar tek başına bağımsız güvenlik sınırı değildir; üretim/test için ayrı sırlar, veritabanları ve uygun ağ/host ayrımı gerekir.

## Bu tur yapılan doğrulamalar

| İş | Sonuç |
|---|---|
| Yeni `npm run verify` | **1030/1030** test, biçim/tip denetimi ve derleme başarılı |
| Yeni kök ve ön yüz `npm audit` | İkisi de **0 açık** |
| Yeni `npm run deploy:verify` | Başarılı; kaynak/çıktı farkları boş |
| Yeni hedefli UI yeniden üretimi | ProgressCard taslağının uzaktan güncellemede kaybolması doğrulandı |
| Yeni sınırlı doğrulama ölçümü | 5000 takvim kaydı → 5000 hata; gerçek sunucuya yük/saldırı gönderilmedi |
| Git/sır/build kontrolleri | Yukarıda kapsam ve sınırlarıyla kaydedildi; gerçek sır rapora yazılmadı |
| Tam tarayıcı paketi | Önceki düzeltme turunda **309 kontrol geçti**; bu ikinci incelemede tam paket tekrar çalıştırılmadı |
| Native MSSQL / Windows | Bu yerel turda çalıştırılmadı; yeni düzeltmeler henüz push edilmediği için yeni commit'in CI kabulü yok |
| Yerel uygulamalar | 3000 ana veritabanı; 3001 ayrı demo DB ve `kp_test_session` çerezi; ikisinde sağlık **200** |

Yeni yerel günlükler: `/tmp/aa-second-review-verify.log`, `/tmp/aa-second-review-root-audit.json`, `/tmp/aa-second-review-frontend-audit.json`, `/tmp/aa-second-review-deploy.log`. Başarılı testler yeni senaryoların tamamının hatasız olduğunu kanıtlamaz; #1 bunun somut örneğidir.

Önerilen sıra: **#1 taslak koruması → #2 sözlük hata bütçesi → #3 bootstrap politikası → #4 Git sır koruması → #5 oturum politikası**. Sonrasında aynı commit üzerinde gerçek yayın kabulü ve kurum ortamı kontrolleri.
