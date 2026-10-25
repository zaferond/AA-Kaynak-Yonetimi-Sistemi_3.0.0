# Son güvenlik, mimari ve frontend incelemesi - 25.10.2026

**Tasarım uygulama güncellemesi:** Kullanıcı onayından sonra Glow menü/sekmeler ve ortak FlowButton yerel uygulamaya eklendi. 1038 otomatik test, biçim/tip/derleme kontrolleri ve hedefli tarayıcı kontrolleri başarılıdır. Kompakt çalışan araç çubuğundaki yükseklik farkı düzeltilip ilgili kontroller yeniden çalıştırıldı. Bu görsel çalışma aşağıdaki üç işlevsel bulgunun düzeltmesi değildir; aşağıdaki inceleme metni tasarım uygulamasından önceki durumun kaydıdır. Filtre satırları da beyaz zemin, kesik çizgili seçim kontrolleri, aramalı açılır listeler ve seçili etiketlerle güncellendi; 27 hedefli filtre tarayıcı kontrolü başarılıdır. Yayında kaynaklarla güncel derleme birlikte alınmalıdır.

## Kapsam ve sonuç

İncelenen çalışma ağacı: `main / daf771e` ve giriş ekranındaki oturum açıklamasını kaldıran yerel değişiklik. Uygulama düzeltmesi yapılmadı; bu tur inceleme ve kontrollü doğrulamadır. Canlı iş veritabanlarına test yazması yapılmadı.

Ayrıca `AA-Kaynak-Yonetimi-Sistemi_4.0.0 / 1825092` GitHub'dan temiz klonlandı. Backend, shared ve frontend kapsamındaki **551 dosya** yerel kaynakla karşılaştırıldı; tek farklı dosya `frontend/src/main.tsx` (henüz yayınlanmamış giriş açıklaması kaldırma işlemi). Aşağıdaki üç yeni bulgunun kaynakları her iki depoda da aynı.

**İki P2 ve bir P3 bulgu doğrulandı.** Bu kontrollerde yeni bir oturumsuz veri erişimi, rol yükseltme veya gerçek sır sızıntısı doğrulanmadı. Bağımlılık taraması ve mevcut testlerin başarısı, aşağıdaki yeni senaryoların hatasız olduğu anlamına gelmez.

## 1. P2 - Değerlendirme filtresi kaydedilmemiş taslağı uyarısız kaybettiriyor

Kaynaklar:

- `frontend/src/features/project-progress/PlanAndEntry.tsx:162`: filtrelenmiş `groups` üretiliyor.
- Aynı dosyada `:407` ve sonrası: yalnız filtreye uyan kartlar render ediliyor.
- `frontend/src/features/project-progress/ProgressCard.tsx:82`: kart kaldırıldığında üst katmandaki kirli kayıt bildirimi de temizleniyor.
- `frontend/src/features/project-progress/ProjectProgressPanel.tsx:64`: sorumlu filtresi proje listesini doğrudan daraltıyor.

**Kontrollü tarayıcı kanıtı:** Sentetik onaylı hedef planın Eylül gerçekleşen alanına **37** ve bir açıklama yazıldı; kaydedilmedi. Hedef Plan filtresi `Proje Ekibi Onayında` olarak seçilince kart kaldırıldı. Filtre `Tümü` yapıldığında alan **boş** döndü. Onay penceresi sayısı **0**, filtre sırasında taslak uyarısı sayısı **0**, DB'de gerçekleşen kaydı **yok**. DB'ye kaydedilmiş veri silinmedi; hiç kaydedilmemiş kullanıcı emeği kayboldu.

**Neden:** Taslak kartın yerel state'inde tutuluyor; filtre değişince component kaldırılıyor. Sekme/çıkış koruması bu filtre setter'larına uygulanmıyor. Önceki uzak güncelleme/CAS düzeltmesi çalışıyor; bu bulgu farklı bir yaşam döngüsüne ait.

**Düzeltme:** Kart taslağını proje + liderlik + ay kimliğiyle filtreleme dışında saklamak veya kartı kaldıran her filtre değişimini açık bırakma onayından geçirmek. Liderlik, sorumlu, hedef/gerçekleşen durumu, bekleyen iş kutuları ve filtre sıfırlama aynı kurala bağlanmalı. Kullanıcının daha önce kabul ettiği açık ay değiştirme davranışı bu bulguyla karıştırılmamalı.

**Kabul:** Filtreyi değiştirip geri döndüğünde 37 ve açıklama korunmalı veya kullanıcı önce açıkça bırakmayı onaylamalı. Korunan taslak açılış revision'ını tutmalı; uzak güncelleme üzerine sessizce yazmamalı.

## 2. P2 - Oturum yenilemede bağlantı kesilince çalışan işin işlem kotası erken bırakılıyor

Kaynaklar:

- `backend/app.mjs:431`: `/api/auth/activity` sıradan async handler ile tanımlı; `admission.handler(...)` kullanmıyor.
- `backend/mutation-admission.mjs:178`: başlangıçta `started: false`.
- Aynı dosyada `:193`: istemci bağlantısı kesilirse başlamadığı düşünülen işin slot'u bırakılıyor.
- `:222-237`: normal handler, işi başladı olarak işaretleyip kotayı işin `finally` aşamasında bırakıyor. Activity yolu bu aşamadan geçmiyor.

**Önemli ayrım:** Oturum yenileme normalde kabul middleware'inden geçiyor; genel olarak kotasız olduğu iddiası doğru değil. Sorun, bağlantı kesildiğindeki yürütme yaşam döngüsüdür.

**Kontrollü kanıt:** Geçici uygulamada aktif sınır **1**, bekleyen sınır **0** olarak ayarlandı. İlk `touchSession` çağrısı kontrollü bir bariyerde geciktirildi. İstemci bağlantısı kesildiğinde bu çağrı henüz tamamlanmamıştı. İkinci aynı oturum isteği buna rağmen yürütmeye girdi: aynı anda devam eden heartbeat çağrısı **2** oldu. Bariyer bırakılınca ikinci istek **200** döndü. Gerçek sunucuya yük testi veya saldırı uygulanmadı.

**Etki:** Geçerli oturum ve CSRF gerektiren erişilebilirlik/yoğunluk sorunu. Yavaş DB veya bağlantı kesilip yeniden denenen isteklerde beklenenden fazla oturum işi birikebilir. Kimlik doğrulama atlama veya yetkisiz iş verisi yazma doğrulanmadı. MSSQL bağlantı havuzunun ve SQL.js seri yürütmesinin kendi sınırları ayrıca devam eder; bu test bir üretim kapasite ölçümü değildir.

**Düzeltme:** Activity handler'ını mevcut `admission.handler` sözleşmesine almak; slot'u bağlantı kesildiğinde değil yürütme gerçekten bittiğinde bırakmak. Kuyruk sonrası oturum doğrulaması ve yalnız gövde alımı sırasında uygulanan timeout aynı sözleşmeyle korunmalı.

**Kabul:** İlk oturum yazması devam ederken istemci ayrılırsa yeni istek aktif sınırı aşamamalı; ilk iş bitene kadar reddedilmeli/beklemeli. Sonrasında normal etkinlik yenilemesi, süresi dolan oturumun reddi ve iş generation'ının değişmemesi korunmalı.

## 3. P3 - Azami oturum uyarısında görünen kapatma simgesi çalışmıyor

Kaynaklar:

- `frontend/src/SessionActivity.tsx:82`: `Dialog` açık durumu kontrollü, `onOpenChange` boş.
- `frontend/components/ui/dialog.tsx:53`: `showCloseButton` varsayılanı `true`; `:78` ve sonrası kapatma simgesini ekliyor.

**Tarayıcı kanıtı:** Geçici oturumun mutlak bitişi dört dakika sonrasına alındı. Uyarı açıldı; görünen `Close` düğmesine basıldı, pencere açık kaldı. 390 x 844 görünümünde de aynı simge mevcut. `Çalışmayı Kaydetmek İçin Dön` düğmesi çalışıyor.

**Etki:** Görünür kontrol ile davranış uyuşmuyor; ekran okuyucu adı da Türkçe arayüzde İngilizce. Bir güvenlik atlaması değildir.

**Düzeltme:** Kapatma simgesini `showCloseButton={false}` ile kaldırmak veya açıkça tanımlanmış güvenli dönüş davranışı ve Türkçe ad vermek. Oturumun mutlak sınırı uzatılmamalı.

## Yayın tutarlılığı takibi

Girişteki `Hareketsizlikte 30 dakika...` açıklaması yerelde kaldırılmıştır. Bu turdaki kontrol anında hem 3.0.0 hem 4.0.0 GitHub main kaynakları hâlâ bu açıklamayı içeriyordu. Kaldırma işlemi henüz commit/push edilmediği için bu durum bekleyen yayın işidir; yeni bir güvenlik açığı olarak sayılmadı. Düzeltmeler yayınlanırken iki reponun kaynakları ve manifest/derlemeleri birlikte eşitlenmeli.

## Güvenlik ve mimari açısından doğrulanan korumalar

- Kök ve frontend audit sonuçları **0**; 4.0.0 temiz klonunun kök audit sonucu da **0**.
- İzlenen sır/ortam dosyası denetimleri her iki depoda başarılı. Yerel `.env` ve `.env.demo` izinleri **0600**; gerçek ortam dosyaları Git'te izlenmiyor. Bu denetim her olası gizlenmiş sır biçimini veya bütün Git geçmişini ispatlayan bir adli tarama değildir.
- Sunucu tarafında oturum, kullanıcı aktifliği/sürümü, Origin/CSRF ve nesne/kapsam yetkileri mevcut. SQL değerleri parametreli; LDAP filtreleri tipli filtre nesneleriyle kuruluyor. Dinamik SQL tablo/sütun kimlikleri doğrulama katmanından geçiyor.
- Üretimde HTTPS APP_ORIGIN zorunluluğu, güvenilir proxy adresleri, HttpOnly/SameSite çerezi, API no-store ve CSP başlıkları korunuyor.
- JSON boyut/sıkıştırma sınırları, büyük geçersiz record'larda erken kesme ve Excel açılmış içerik bütçeleri mevcut.
- Aktivite kişi kapsamı organizasyon görevinden geliyor; Yönetici rolü ve planlama liderliği kapsamı genişletmiyor. Mevcut otomatik testler bu kuralı ve takım geçmişini kapsıyor.
- Oturumun sunucu tarafı hareketsizlik/mutlak sınırları, arka plan okumasının süre uzatmaması ve eski heartbeat zamanının geri alınmaması önceki regresyon testlerinden geçti.
- Tam snapshot doğrulaması ve MSSQL yazma kilidi mevcut tasarımın bakım/ölçek noktaları olarak sürüyor. Ölçülmeden yeniden yazım veya üretim kapasite garantisi verilmedi.

## FlowButton tasarım uygunluğu

Kullanıcının paylaştığı [FlowButton](https://21st.dev/@xubohuah/components/flow-button) sayfası React/Tailwind, lucide-react bağımlılığı ve MIT lisansı bildiriyor. Projede React ve lucide-react zaten mevcut. Kurumsal renk, boyut, odak, pasif/yükleniyor ve azaltılmış hareket durumlarıyla ana işlem düğmelerine uyarlanabilir. Yoğun tablo araçları için kompakt düğmeler korunabilir. Tam bileşen kaynağı sayfada hesap gerektiriyor; bu tur bileşenin tam kod denetimi veya uygulamaya entegrasyonu yapılmadı.

[Glow menu](https://21st.dev/@spoonyvu/components/glow-menu) referansının sayfası da MIT lisansı, lucide-react ve framer-motion bağımlılıklarını bildiriyor. Mevcut ekranlar üzerinde Glow/Flow esinli geçici CSS önizlemeleri hazırlandı: `output/tasarim-onizleme/`. Menü/sekmelerde hafif aktif durum ışığı ve ana işlemlerde oklu buton önerildi. Bu dosyalar üretim kaynaklarına eklenmedi, bağımlılık kurulmadı; gerçek uygulama entegrasyonu kullanıcının görsel değerlendirmesini bekliyor.

## Test ve inceleme sonuçları

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | **1038/1038**, 0 başarısız/atlanan; biçim, TypeScript ve üretim derlemesi başarılı |
| Kök ve frontend `npm audit` | **0 açık** |
| 4.0.0 temiz klon kök audit | **0 açık** |
| İzlenen sır denetimleri | Her iki depoda başarılı |
| Dağıtım bütünlüğü | Yerel geliştirme ağacı ve 4.0.0 temiz klon başarılı |
| Temiz paket kabulü | Başarılı; 659 kaynak, 66 güncel çıktı, 1643 tarihsel çıktı dışarıda |
| Yeni izole tarayıcı senaryoları | Üç bulgu yeniden üretildi; JavaScript hata listesi boş |
| Tam izole UI paketi | **311/311** kontrol başarılı; süreç çıkış kodu 0 |
| Çalışan 3000/3001 HTTP kontrolü | İkisinde sağlık 200; oturumsuz data/users 401; .env, .git/config, DB ve backend dosyaları 404; no-store/nosniff/frame engeli mevcut |
| Responsive görsel kontrol | Oturum uyarısı 390 x 844 boyutunda incelendi; tam mobil/tarayıcı erişilebilirlik kabulü değildir |
| Native MSSQL / Windows / kurum LDAPS-proxy | Bu yerel turda çalıştırılmadı |

Tam tarayıcı paketi; ekran geçişleri, plan/aktivite girişleri, rol sınırları, değerlendirme, senaryolar, filtreler, kaydırma, içe aktarma/geri dönüş, rapor/Excel ve eşzamanlı düzenlemeleri kapsar. Tek tarayıcı/işletim sistemi koşusu bütün tarayıcıları veya üretim yükünü temsil etmez.

Kanıtlar: `/tmp/aa-final-review-verify.log`, `/tmp/aa-final-review-browser.log`, `/tmp/aa-final-review-reproductions.log`, `/tmp/aa-final-review-audit-root.json`, `/tmp/aa-final-review-audit-frontend.json`, `/tmp/aa-final-review-4-audit.json`, `/tmp/aa-final-review-deploy.log`, `/tmp/aa-final-review-4-deploy.log`, `/tmp/aa-final-review-package.log`, `/tmp/aa-final-review-local-http.log`. Geçici senaryolar ve görseller `tmp/review-2026-10-25/` altındadır; Git'e eklenmez ve gerçek kullanıcı verisi içermez.

Öncelik: **filtrelerde taslak koruması ve oturum işinin kota yaşam döngüsü**, ardından oturum uyarısının kapatma kontrolü; yayın öncesinde iki repo eşitlemesi ve kurum ortamı kabulleri.
