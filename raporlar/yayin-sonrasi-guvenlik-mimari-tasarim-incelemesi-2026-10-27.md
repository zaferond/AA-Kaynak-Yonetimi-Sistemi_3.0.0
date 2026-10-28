# Yayın sonrası yeniden inceleme - 27.10.2026

Son kabul güncellemesi: **28.10.2026**. Tablodaki durumlar günceldir; ilk inceleme ve ara doğrulama kayıtları aşağıda korunmuştur.

## Kapsam ve sonuç

İncelenen sürümler: geliştirme `46131abffc52e2adf626fa058de6d3d0a9411903`, çalıştırma `632b48b684128b61a8782afd43590532cac8a68b`. Kaynaklar, kimlik/yetki denetimleri, AD/Sicil No akışları, HTTP ve statik dosya sunumu, transaction/işlem kotası, bağımlılıklar ve son arayüz değişiklikleri yeniden kontrol edildi.

**Bir yüksek öncelikli güvenlik bulgusu (G-01) açık. M-01, M-02 ve Q-01 kapandı. 1062 otomatik test ve tam pakette 366 tarayıcı kontrolü geçti. AD geçişiyle ilgili M-03, Sicil No zorunluluğunun kaldırılmasıyla kapandı.** Yeni dışarıdan yetki aşımı, SQL enjeksiyonu veya XSS bu incelemede doğrulanmadı. İnceleme aşamasında kod değiştirilmedi; sonradan kullanıcı talebiyle aşağıda kaydedilen geliştirmeler uygulandı. Gerçek kullanıcı parolaları değiştirilmedi. Testler geçici verilerle yapıldı.

| Öncelik | Bulgu | Sonuç |
|---|---|---|
| Yüksek / G-01 | Git'teki örnekle aynı aktif ana yönetici parolası | İki yerel ortamda yeniden doğrulandı; devam ediyor. |
| Orta / M-01 | Tamamlanan projeleri gizlerken aktif hücre taslağının kaybolması | Kapandı: aktif/tamamlanan tüm hücre taslakları görünümün iki yönünde de korunuyor. |
| Orta / M-02 | Takım/AD seçme sırasının varsayılan planlama yetkisini değiştirmesi | Kapandı: seçim sırası aynı varsayılanı üretir; açık yetki tercihleri korunur. |
| Kapandı / M-03 | Eski pasif AD hesabının yeni eşleştirmeleri engellemesi | Sicil No zorunluluğu kaldırıldı; benzersiz kullanıcı adıyla kayıt pasif eski hesap yüzünden engellenmiyor. |
| Düşük / Q-01 | Tam tarayıcı paketindeki eski manuel çalışan oluşturma varsayımı | Kapandı: güncel AD/filtre akışlarıyla tam tarayıcı paketi 366/366 başarılı. |

## G-01 - Yönetici parolası

1060 izlenen metin dosyası tarandı. Yapılandırılmış gizli değerle eşleşen dosyalar:

- `MIMARI-VERITABANI-GUVENLIK-PERFORMANS-INCELEMESI-2026-10-23.md`
- `tests/admin-password.test.mjs`
- `tests/password-change-http.test.mjs`

Aynı değer, her iki veritabanındaki aktif `root-admin` parolasıyla salt okunur doğrulamada eşleşti; zorunlu parola değişimi kapalı. Parola veya hash bu rapora alınmadı, gerçek yönetici girişi yapılmadı. Bu dosyalardaki örnekler gerçek hesapta kullanıldığı için risk oluşuyor; test parolası olması riski ortadan kaldırmıyor.

API anahtarı/özel anahtar biçimindeki desen taraması eşleşme vermedi. Güncel derlenmiş JS/CSS/HTML'de yapılandırılmış gizli değer bulunmadı. `.env` izni `0600`. İki servis loopback üzerinden çalışıyor; internetten erişim veya üretim hesabı ele geçirme denenmedi.

**Düzeltme/kabul:** İki ortamda birbirinden farklı yeni özel parolalar kullanılmalı; eski oturumlar iptal edilmeli ve ilk kurulum ayarı eski değeri yeniden kullanmamalı. Açığa çıkmış değeri yalnız kaynaktan silmek yeterli değildir; [OWASP sır yönetimi rehberi](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) yenileme ve iptal yaklaşımını destekler.

## M-01 - Kapandı: kaydedilmemiş aktif hücre taslağı

**Güncel durum:** Tablodaki tüm taslaklar iki yöndeki görünüm geçişinde korunuyor. Aşağıdaki yeniden üretim düzeltme öncesine aittir.

Kaynak: `frontend/src/features/PlannedAllocationPanel.tsx:33`, `frontend/src/features/planned-allocation/PlannedAllocationTable.tsx:54`.

Altı aylık takım görünümünde 21 projeyle sınandı. İlk sıralardaki tamamlanan proje gizlenince son sıradaki aktif proje başka `tbody` bölümüne taşınıyor. Aktif hücredeki `0,7` kaydı sentetik 503 ile reddedilmişken filtre değiştirilince hücre boşaldı ve hata kayboldu: `t1:1` -> `t1:0`. Veritabanı değeri `0` kaldı. **Kaydedilmiş veri silinmiyor; kaydedilmemiş taslak kayboluyor.** Koruma yalnız tamamlanan proje hücrelerine bakıyor, yeniden parçalanan aktif satırı kapsamıyor.

Kabul: Aktif ve tamamlanan tüm kirli/bekleyen/hatalı hücreler geçişte korunmalı veya taslaklar satırdan bağımsız saklanmalı. Sınırdaki aktif satır ve başarısız kayıt kabul testine eklenmeli.

Yeni kanıt: `/tmp/aa-reaudit-20261027-chunk-draft.log`, geçici görseller `aa-browser-checks-fQciko` klasöründe.

## M-02 - Kapandı: varsayılan planlama yetkisinde seçim sırası

**Güncel durum:** AD/takım sırası aynı varsayılan kapsamı üretir; elle yapılan kapsam seçimi korunur. Aşağıdaki yeniden üretim düzeltme öncesine aittir.

Kaynak: `frontend/src/features/editors/ResourceEditorFields.tsx:60`, `defaultScope` koşulu.

Aynı çalışan rolü, takım, AD kişisi ve Yönetici uygulama rolüyle yetki kutularına dokunmadan kayıt yapıldı. Takım önce seçildiğinde takımın liderliği kayda geçti, ağaçta 9 satır seçildi. AD kişisi önce seçildiğinde liderlik ve takım yetkileri boş kaldı, ağaçta 0 satır seçildi. Çalışanın organizasyon ataması iki durumda aynıydı.

Bu, adminin yetkilendirme akışındaki tutarsız varsayılan kapsamdır; dışarıdan yetki yükseltme değildir. Aktivite yetkisinin kaynak görevinden gelmesi kararı değişmez. Buradaki kapsam, **planlanan kaynak dağılımını düzenleme yetkisidir**.

Kabul: İki seçim sırası aynı açık tercihlerle aynı kaydı üretmeli; adminin elle değiştirdiği yetkiler korunmalıdır.

Yeni kanıt: `/tmp/aa-reaudit-20261027-ad-order.log`, `aa-browser-checks-xncHO9` ve `aa-browser-checks-gJIzI0` geçici çıktı klasörleri.

## M-03 - Kapandı: eski AD hesabının yeni kayıtları engellemesi

Önceki Sicil No yaklaşımında, numarası eksik tek bir eski pasif AD hesabı bütün yeni kullanıcı eşleştirmelerini durduruyordu. Kullanıcı kararıyla Sicil No formdan, AD alan sorgusundan ve hesap eşleştirme zorunluluğundan kaldırıldı. Bu global engelleme artık yoktur.

Yeni eşleştirme kullanıcı adı üzerinden denetlenir. Ad boşlukları temizlenip küçük harfe dönüştürülür; aktif/pasif veya yerel/AD hesabı ayrımı olmadan mevcut kullanıcı adı ikinci hesapta kullanılamaz. Değişmez AD kimliği kontrolü de sürer. Kontrol hem arama sonucunda uyarı/kapalı Seç olarak hem sunucuda transaction içinde uygulanır. Mevcut tekil SQL kullanıcı adı kısıtı korunur.

Pasif eski AD hesabı varken farklı, benzersiz kullanıcı adıyla yeni kayıt oluşturulması testte başarılıdır. Farklı GUID ile aynı kullanıcı adı, harf büyüklüğü/kenar boşluğu farkı, pasif hesabın adını yeniden kullanma, sahte istemci kullanıcı adı ve eşzamanlı oluşturma testleri geçti. Sicil No'nun AD'den istenmediği ve API'de gösterilmediği de doğrulandı.

Şema 48'in tarihsel geçiş dosyaları ve eski nullable kolonları kurulum/yedek uyumluluğu için korunur; yeni akış bu alanları okumaz veya doldurmaz. Şema geçmişi geriye alınmadı. Gerçek kullanıcı parolaları ve iş kayıtları değiştirilmedi.

## Mimari, HTTP ve performans

MSSQL'de parametreli SQL kullanılıyor; tablo/sütun adları uygulama içi tanımlardan geliyor. Yazma transaction'ı aktif kullanıcı sürümünü tekrar doğruluyor; değişiklik, hesap bağı ve işlem geçmişi birlikte commit/rollback oluyor. Okuma/yazma kuyrukları sınırlı; sağlık kontrolü aynı süren DB işini paylaşıyor. Önceki sağlık kontrolü birikme sorunu için düzeltme korunuyor.

Her iki portta sağlık 200, oturumsuz `/api/data` 401; `.env`, `.git/config`, backend kaynak dosyası ve SQLite dosyası için 404 alındı. CSP ve API `no-store` başlıkları mevcut. Production yapılandırması HTTPS zorunlu kılıyor; çerezlerde HttpOnly/SameSite ve HTTPS'te Secure uygulanıyor. Bu, üretim proxy/TLS kurulumu kabulü değildir.

Yerel incelemede yeni performans darboğazı doğrulanmadı. Üretim ölçeğinde yük testi yapılmadığından kapasite/SLA sonucu verilmez. MSSQL sertifika doğrulaması üretim ayarında zorunlu; native Windows/MSSQL ve gerçek kurumsal LDAPS bu ortamda sınanmadı.

## Doğrulama özeti (ilk inceleme)

- `npm test`: **1059/1059 başarılı**, 0 atlanan.
- Biçim ve TypeScript kontrolleri, gizli bilgi desen kontrolü ve derleme/kaynak bütünlüğü: başarılı. Derleme yeniden yazılmadı; yayımlanan dosyalar manifest ile karşılaştırıldı.
- Root ve frontend `npm audit`: **0 bilinen bağımlılık açığı**.
- İlk incelemenin Sicil No kontrolleri, son kullanıcı kararıyla kullanıcı adı kontrolleriyle değiştirildi; güncel sonuçlar aşağıdaki son doğrulama bölümündedir.
- M-01 ve M-02 ayrı tarayıcı yeniden üretimlerinde hâlâ mevcut. M-03 yeni akışla kapandı.
- Tam tarayıcı paketi bu tur yeniden çalıştırılmadı. Q-01'in eski manuel Ad Soyad ve `/api/changes` varsayımı kaynakta sürüyor; önceki 197 kontrol sonrası kesilen çalışmanın geri kalanı başarılı sayılmıyor.

Yerel kanıtlar `/tmp/aa-reaudit-20261027-*` dosyalarında. Gerçek iş verilerine yazılmadı, gerçek parola değiştirilmedi ve bu inceleme için commit/push yapılmadı.

## Kullanım belgesi

İnceleme sonrasında kullanıcı talebiyle kullanıcı manueli ve yetki matrisi 3.3 / 27.10.2026 olarak güncellendi. Birleşik PDF 30 sayfa, ayrı yetki matrisi 3 sayfadır; 34 güncel uygulama görseli kullanıldı. Son belge ve görsel doğrulama kaydı, `docs/kullanici-manueli/README.md` içinde tutulur. Belge güncellemesi uygulama bulgularını kapatmaz.

## İnceleme sonrası istenen filtre geliştirmesi

Hedef/gerçekleşen girişindeki bekleyen iş adları yenilendi. Üst Hedef Plan/Gerçekleşen Plan açılır filtreleri ve bekleyen işler satırındaki Tümü kaldırıldı; aynı anda en fazla bir kategori seçiliyor. Etkin kategoriye yeniden basmak filtreyi temizliyor. Ay satırı yalnız gerçekleşen giriş/değerlendirme seçiminde açılıyor; değerlendirme seçildiğinde mevcut varsayılan işlem ayı kullanılıyor. Büyük özet kartları kullanıcı tercihiyle kaldırıldı; giriş sekmesinde turuncu hedef plan, mavi gerçekleşen adetleri gösteriliyor. Liderlik/proje sorumlusu ve ay değişince sayılar yetkili kapsamda güncelleniyor, diğer birimin sayıları Yönetici'ye açılmıyor.

`npm run verify`: 1059/1059 test, biçim, TypeScript ve derleme başarılı. Yeni filtre/sayaç için 6 ve mevcut taslak/oturum koruması için 2 odaklı tarayıcı kontrolü geçti (`/tmp/aa-progress-tab-counts-ui.log`). Masaüstü ve 390 piksel görünüm doğrulandı. Ay/kategori geçişinde kaydedilmemiş taslağı bırakma onayı korunuyor. G-01, M-01, M-02 ve eski tam tarayıcı paketiyle ilgili Q-01 açık kalır; M-03 son kullanıcı adı düzenlemesiyle kapandı.

## Aktivite Giriş - tamamlanan proje görünümü

Kullanıcı isteğiyle, Sadece veri olanlar yanına Tamamlanan projeleri göster seçimi eklendi. İlk açılışta kapalıdır; Kaynak Planlama seçeneğinden bağımsızdır. Proje ve kişi görünümleri, veri olan satırlar ve Excel aynı görünür proje listesini kullanır. Kişi/ay toplamları, kapasite ve sunucu sınırları tam yetkili veri üzerinden korunur; tamamlanan proje kaydı silinmez. Yalnız tamamlanan proje filtrelenip gizli kaldığında açık bir gösterme eylemi sunulur.

Yeni seçim her iki yönde de tüm kirli/bekleyen/hatalı aktivite hücreleri ve çalışılan saat taslakları için korunur. Böylece görünüm değişiminden kaynaklanan yeni bir taslak kaybı eklenmemiştir. Bu koruma Aktivite Giriş içindir; Kaynak Planlama'daki M-01 ayrı açık bulgu olarak devam eder.

6 yeni tamamlanan-aktivite kontrolü, 4 mevcut tamamlanan-planlama kontrolü, 1 aktivite kayıt/odak kontrolü ve 3 kişi bazlı aktivite kontrolü geçti: **14/14** (`/tmp/aa-completed-actual-ui.log`). Hedef/gerçekleşen sayaç/filtre kontrolleriyle bu geliştirme turunda **22 odaklı tarayıcı kontrolü** başarılı. Son `npm run verify` yine **1059/1059** test, tip ve derleme kontrolünü geçti. Gerçek kayıtlar ve parolalar değiştirilmedi.

## Tamamlanmış ay seçimi ve aktivite açıklama satırı

Kullanıcı isteğiyle Hedef Plan / Gerçekleşen Plan Giriş ay satırı yalnız tamamlanmış ayları seçtirir: Ekim ayı 1 Kasım'da açılır. Önceki davranış, takibi başlamış mevcut ayı da seçtirmekti; varsayılan önceki ay olsa da mevcut ay düğmesi açıktı. Proje ve Kaynak Değerlendirme Raporu mevcut ayı görüntülemeye devam eder. Raporda mevcut ay seçilip giriş sekmesine dönülürse giriş seçimi son uygun tamamlanmış aya çekilir. Ay kilidiyle karıştırılmamalıdır; kilitli geçmiş ayın düzenleme kuralları korunur. Bu değişiklik giriş ekranının ay seçimine uygulanmıştır; diğer Aktivite Giriş takvimi ve API yetkileri genişletilmemiştir.

Aktivite Giriş'teki hücre altı çubuklarını açıklayan uzun yazı kaldırıldı; çubuklar ve üst Kalan alanı korunuyor. Ekim/Kasım geçişi, yıl devri ve takip başlangıcı için 3 ek takvim testi eklendi.

## Son kullanıcı kararı: Sicil No kaldırıldı

Kullanıcı adı eşsiz hesap anahtarı olarak esas alındı. Yeni kullanıcı ekranında Sicil No alanı yok; AD kullanıcı araması numara alanını istemiyor. Arama sonucu aynı kullanıcı adı/AD kimliği için tekrar kayıt uyarısı verir. Yetkisi kaldırılmış hesaplar da kullanıcı adını rezerve tutar. Eski global numara-tamamlama engeli kaldırıldı; M-03 kapanmıştır. Kullanıcı manueli ve yetki matrisi bu kararla eşitlendi. Ekim ayının Kasım'da açılması ve Aktivite Giriş açıklama yazısının kaldırılması korunmuştur.

### Son doğrulama

Kullanıcı adı eşleştirme değişikliğinden sonra `npm run verify`: **1062/1062** test, biçim, TypeScript ve derleme başarılı. Kullanıcı adı/AD seçimi ve ilan statüsü için **4**, tamamlanmış ay/filtre/sayaç/taslak/oturum için **8**, aktivite/planlama regresyonları için **14** odaklı tarayıcı kontrolü geçti: **26/26**. Kayıtlı parolalar değiştirilmedi; şema geçmişi 48 olarak korundu.


### Son metin ve yayın öncesi yerel kontrol

Sadece Veri Olanlar / Tamamlanan Projeleri Göster adları Kaynak Planlama ve Aktivite Giriş ekranlarında eşitlendi. Haftalık Kritik Konular seçimleri Tüm Haftalar, Geçen Hafta, Bu Hafta, Gelecek Hafta ve Hafta Ekle olarak güncellendi. Bu akış için 2 mevcut tarayıcı kontrolü de geçti; son uygulama üzerinde yukarıdaki 26 kontrol yeniden çalıştırıldı: toplam **28/28**. Derleme, biçim, gizli bilgi desen kontrolü ve deployment manifest doğrulaması başarılı.

30 sayfalık kullanıcı manueli ve 3 sayfalık yetki matrisi 34 güncel görselle yeniden üretildi; tüm sayfalar görsel olarak incelendi. Sicil No alanı ve gerekliliği güncel belgelerden çıkarıldı. 3000 ve 3001 sunucuları yeni kodla yeniden başlatıldı; sağlık uçları 200. Durdurma sonrası özel dosya izinleriyle alınan yedeklerle karşılaştırıldığında oturum tabloları dışında tüm hesap/iş kayıtları aynı, şema 48. Kayıtlı parolalar değiştirilmedi. Bu ara kontrol aşamasında henüz commit/push yapılmamıştı.


## M-01 / M-02 düzeltmeleri

Kaynak Planlama görünüm seçimi artık yalnız tamamlanan satırlara değil tablodaki tüm kirli, bekleyen veya hata almış hücrelere bakıyor. İki yönde de geçiş durdurulur; kayıt veya Escape ile açık iptal sonrasında görünüm değişebilir. 21 proje ve altı aylık takım görünümünde, parça sınırındaki aktif satırın 503 sonrası taslağı, hata metni ve veritabanı kaydı doğrulandı.

Yeni AD hesabının varsayılan planlama kapsamı, AD kişisinin seçilip seçilmediğinden bağımsız olarak organizasyon seçimini izler. Liderlik/takım yetkisini elle değiştiren, Tümünü Seç veya Seçimi Temizle yapan kullanıcının tercihi taslakta işaretlenir ve sonraki organizasyon/AD değişiklikleriyle üzerine yazılmaz. Mevcut hesapların yetkileri otomatik değiştirilmez. Rol değişimindeki organizasyon güncellemesi de aynı varsayılan kapsam kuralını kullanır.

Kalıcı regresyonlar: `scripts/browser-checks/planning-regressions.mjs`. İki görünüm yönü ve dört hesap oluşturma sırası/tercihi için **6/6** kontrol geçti. Gerçek kurumsal AD kullanılmadı; kayıtlar geçici sentetik veritabanlarına yazıldı.


## Q-01 - Kapandı: tam tarayıcı paketi güncel akışla çalışıyor

Eski elle Ad Soyad doldurma adımı, sentetik AD kullanıcısının aratılıp seçilmesiyle değiştirildi. Çalışan oluşturma kontrolü birleşik `/api/employees/save` yanıtını bekliyor. Test sonunda oluşturulan hesabın liderlik yetkisi de temizleniyor; böylece test liderliği referans bırakmadan kaldırılabiliyor.

Hedef/gerçekleşen testleri tek seçimli bekleyen iş filtrelerine, yeni adlara ve yalnız tamamlanmış ayların girişe açılması kuralına uyarlandı. Eylül ve Ekim işlemlerini sınayan akışın tarayıcı tarihi Kasım olarak sabitlendi. Senaryo aktarımında satırın ekrandan kaldırılması, filtre seçiminde açılış animasyonunun bitmesi ve aktivite raporunda tablonun yüklenmesi bekleniyor. Güncel davranışa ait iş akışları atlanmadı; sonuçlar gerçek UI/API doğrulamalarıyla alındı. Test çalıştırıcısındaki yinelenen filtre testi içe aktarımı da düzeltildi.

## Son kabul - 28.10.2026

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | 1062/1062 test; 0 hata, 0 atlanan. Biçim, TypeScript ve derleme başarılı. |
| `node scripts/run-browser-checks-isolated.mjs` | Tam paket başarılı, çıkış kodu 0. Normal sürüm ve izole test sürümü dahil 366 tarayıcı kontrolü. |
| M-01 / M-02 regresyonları | Altı yeni kontrol tam pakete dahil; aktif satır taslağı ve açık yetki tercihleri korunuyor. |
| `npm run deploy:verify` | Kaynak ve derleme bütünlüğü başarılı. |
| `npm run check:secrets` | İzlenen ortam dosyası ve gizli bilgi desen kontrolleri başarılı. |
| Yerel ortamlar | 3000 ve 3001 sağlık uçları 200; açılış öncesi yedeklerle hesap/iş kayıtları aynı, şema 48. |

Çalışma ortamı yeniden başladığı için önceki yarım koşu başarı sayılmadı; tam paket 28.10.2026 tarihinde yeniden çalıştırılıp tamamlandı. Kayıtlar `tmp/final-ui-20261028.log`, `tmp/final-verify-20261028.log` ve `tmp/final-validation-20261028.json` içinde tutulur. Gerçek kurumsal AD ve native Windows/MSSQL kabulü bu yerel test kapsamına dahil değildir.

**Açık kalan bulgu: G-01.** Gerçek yönetici parolaları bu düzeltme kapsamında değiştirilmedi; parola yenileme gerekliliği devam ediyor.
