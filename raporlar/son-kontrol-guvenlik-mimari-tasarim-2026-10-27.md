# Son kontrol: güvenlik, mimari ve tasarım — 27.10.2026

## Kapsam ve sonuç

İnceleme başlangıcı: geliştirme deposu `main` / `cf5ea7478b8c94b6955b5dbc1c0e8492f82efae2`; önceki çalıştırma deposu sürümü `45a773124150d49108a1e23b4658dcc2b73aba30`. Bu raporda sonradan kullanıcı isteğiyle eklenen Sicil No geliştirmesi ayrıca belirtilmiştir; henüz commit/push yapılmamıştır.

Kaynak kodu, API yetki ve oturum kontrolleri, AD hesap eşleştirme, SQL.js migration/yedekleme, bağımlılıklar, derlenmiş çıktı, filtre/hücre taslakları ve sentetik tarayıcı akışları incelendi. Gerçek kullanıcı şifreleri değiştirilmedi. Yeni bir dışarıdan yetki aşımı veya SQL enjeksiyonu doğrulanmadı. Aşağıdaki açık bulgular devam ediyor.

| Öncelik | Bulgu | Durum |
|---|---|---|
| Yüksek / G-01 | Kaynakta yer alan örnekle aynı aktif yerel yönetici parolası | Önceki bulgu devam ediyor; kimlik bilgisi yenilemesi gerekli. |
| Orta / M-01 | Tamamlanan projeleri gizlemek aktif proje hücresindeki kaydedilmemiş taslağı silebiliyor | Yeni, sentetik tarayıcıda yeniden üretildi. |
| Orta / M-02 | Takım ve AD kullanıcısının seçilme sırası varsayılan planlama yetkisini değiştiriyor | Yeni, iki akış da kaydedilerek doğrulandı. |
| Düşük / B-01 | Kullanıcı kılavuzunun son akışlarla eşitlenmesi gerekiyor | Önceki belge işi sürüyor. |
| Düşük / Q-01 | Tam tarayıcı paketinde eski manuel çalışan oluşturma varsayımı var | 197 başarılı kontrol sonrasında test duruyor; tam paket başarılı sayılmadı. |

## G-01 — Aktif yönetici kimlik bilgisi

Git'te izlenen üç metin dosyasında yer alan yapılandırılmış yönetici parolasının, 3000 ve 3001 ortamlarındaki aktif ana yönetici kayıtlarıyla hâlâ eşleştiği, salt okunur parola doğrulamasıyla teyit edildi. Bu hesaplarda zorunlu parola değişimi kapalı. Değer ve parola hashleri bu rapora alınmadı; gerçek hesapla giriş yapılmadı.

Mevcut derlenmiş JS/CSS/HTML içinde değer bulunmadı; `.env` izinleri `0600`, veri klasörü `0700`. İki sunucu `127.0.0.1` üzerinden çalışıyor. Dolayısıyla internetten erişilen bir saldırı doğrulanmış değildir; bilinen değerin gerçek hesapta kullanılması riski devam eder.

Kabul: İki ortamda farklı, özel parolalar kullanılmalı; eski yönetici oturumları iptal edilmeli, ilk kurulum yapılandırması da eski değeri yeniden kullanmamalıdır. Kaynaktan silmek tek başına yeterli değildir. Önceki [ayrıntılı güvenlik raporu](son-guvenlik-mimari-performans-arayuz-incelemesi-2026-10-27.md) geçerlidir.

## M-01 — Aktif proje hücresinde taslak kaybı

Kaynaklar: `frontend/src/features/PlannedAllocationPanel.tsx`, `frontend/src/features/planned-allocation/PlannedAllocationTable.tsx`.

Tamamlanan projeleri gizleme koruması yalnız tamamlanan proje satırlarının düzenlenmesini kontrol ediyor. Oysa takım görünümünde projeler hücre sayısına göre ayrı `tbody` parçalarına bölünüyor. Önceki bir satır kaldırılınca aktif proje başka parçaya taşınıyor; React hücreyi yeniden oluşturduğu için yerel taslak ve hata durumu kaybolabiliyor.

Yeniden üretim: Altı aylık görünüm, 21 proje; ilk sıralardaki bir proje tamamlanmış, son sıradaki proje aktif. Aktif hücreye `0,7` girildi, kayıt isteği sentetik 503 ile reddedildi. Hücre taslağı ve hata görünürken tamamlanan projeler gizlendi. Aktif satırın bölümü `t1:1` → `t1:0` oldu; hücre boşaldı, hata kayboldu. Veritabanı değeri her iki durumda da `0` kaldı. **Kaydedilmiş veri silinmiyor; kaydedilmemiş giriş kayboluyor.**

Öneri: Filtre nedeniyle yeniden parçalanan tabloda tüm kirli/bekleyen/hatalı hücreler için geçiş koruması veya satırdan bağımsız taslak saklama uygulanmalı. Kabul testi, sınırdaki aktif satırı ve reddedilmiş kaydı da içermelidir.

Yerel kanıtlar: `tmp/final-audit-20261027/chunk-draft-probe.mjs`, `/tmp/aa-final-audit-20261027-chunk-draft.json`; sentetik ekranlar `aa-browser-checks-Xwp8Tn` geçici çıktı klasöründe.

## M-02 — Seçim sırasına göre farklı varsayılan planlama kapsamı

Kaynak: `frontend/src/features/editors/ResourceEditorFields.tsx`, `setVersion` içindeki `defaultScope` koşulu. AD kişisi seçilmişse varsayılan liderlik güncellemesi duruyor.

Aynı takım, kaynak rolü, AD kullanıcısı ve Yönetici hesap rolüyle, planlama yetkisi kutularına dokunulmadan iki akış kaydedildi:

| İşlem sırası | Kaydedilen planlama yetkisi |
|---|---|
| Önce takım, sonra AD kullanıcısı, sonra Yönetici rolü | Takımın liderliği; yetki ağacında 9 satır seçili |
| Önce AD kullanıcısı, sonra takım, sonra Yönetici rolü | Liderlik ve takım yetkileri boş; 0 satır seçili |

Her iki kaynağın organizasyon ataması aynı. Bu, adminin yaptığı yetkilendirme işlemindeki tutarsız başlangıç değeri; dışarıdan yetki yükseltme değildir. Aktivite giriş/rapor yetkisinin kaynak rolünden alınması kararı değişmemiştir; burada konu **planlanan kaynak dağılımını düzenleme kapsamıdır**.

Öneri: Başlangıç kapsamı seçim sırasından bağımsız olmalı; yöneticinin açıkça değiştirdiği yetkiler ayrıca takip edilmeli ve korunmalıdır. Kabul: İki işlem sırası aynı açık seçimlerle aynı kaydı üretmelidir.

Yerel kanıtlar: `tmp/final-audit-20261027/ad-order-probe.mjs`, `/tmp/aa-final-audit-20261027-ad-order.json`; `aa-browser-checks-ZETMcE` ve `aa-browser-checks-fIWSog` geçici çıktı klasörleri.

## B-01 ve Q-01 — Belge ve test akışı

Kullanıcı kılavuzu 3.2 / 25.10.2026 sürümünde. Otomatik AD seçimi zorunluluğu, Kullanıcı Ara / Seç akışı, tamamlanan projeleri göster filtresi ve son senaryo düzeniyle yeniden eşitlenmeli. Bu tur teknik AD bağlantı belgesi Sicil No için güncellendi; kullanıcı kılavuzu bütünü yenilenmedi.

Tam tarayıcı testi, `scripts/browser-checks/directory-management.mjs` içindeki doğrudan lider kaydı kontrolünde Ad Soyad'ı elle doldurmaya çalışıyor. Güncel formda iki salt okunur Ad Soyad alanı bulunduğundan Playwright strict locator hatasıyla durdu. 197 kontrol geçti; kalan kontroller çalışmadı. Bu sonuç uygulamada kaydın bozuk olduğunu kanıtlamaz; testin geçerli AD seçimi ve `/api/employees/save` akışına uyarlanması gerekir.

## Kullanıcı talebiyle tamamlanan Sicil No geliştirmesi

- Sicil No AD'den alınır; Ad Soyad'ın üzerinde salt okunur gösterilir.
- `AD_EMPLOYEE_NUMBER_ATTRIBUTE` varsayılanı `employeeID`; IT bunu kurumun gerçek Sicil No alanına göre değiştirebilir.
- AD kimliği ve kullanıcı adı kontrollerine ek olarak, Sicil No başka hesapta varsa uyarı verilir ve ikinci eşleştirme reddedilir. Yetkisi kaldırılan hesabın numarası da saklı kalır.
- Eksik Sicil No ile yeni eşleştirme yapılamaz. İstemcinin numarayı değiştiren ek payload'u kabul edilmez; sunucu AD kaydını yeniden okur.
- Baştaki sıfırlar korunur; Unicode uyumlu yazım, kenar boşlukları ve harf büyüklüğü aynı karşılaştırmaya dönüşür.
- Şema 48: numara ve tekil karşılaştırma anahtarı SQL.js/MSSQL'e eklendi. İşlem içi kontrol ve SQL tekil indeksi eşzamanlı talepleri de korur.
- Eski AD hesaplarının eksik numarası başarılı AD girişinde tamamlanır. Eksik eski eşleştirme varken yeni hesap açılması engellenir; başka hesabın numarasıyla sessiz yeniden bağlama yapılmaz.
- İki yerel veritabanında geçiş öncesi AD hesabı sayısı 0; mevcut yerel hesaplara Sicil No zorunluluğu eklenmedi.

Kurulum ve geçiş ayrıntıları: [Active Directory bağlantı belgesi](../ACTIVE-DIRECTORY-LDAP.md).

## Doğrulamalar ve sınırlar

Başlangıç sürümünde `npm run verify`: **1056/1056 test**, biçim, tip ve derleme başarılı. Root/frontend `npm audit`: bilinen açık **0**. `check:secrets` ve dağıtım bütünlüğü kontrolü başarılı. Bu taramalar G-01'i kapatmaz.

Her iki portta `/api/health` 200, oturumsuz `/api/data` 401; `/.env`, `/.git/config`, `/backend/server.mjs`, `/data/planlama.sqlite` 404. Sağlık kontrolü ve küçük ekran senaryo ismi için önceki düzeltmeler korunuyor.

Sicil No odaklı tarayıcı testlerinde ikinci eşleştirme/eksik numaranın seçilememesi ve iki panelde alanın salt okunur, doğru sırada olması doğrulandı. İlan statüsüne geçişte hesap seçiminin temizlenmesi ve ilan kaydının hesap oluşturmadan kaydedilmesi de geçti: **4/4 kontrol**.

Gerçek kurumsal LDAP/LDAPS, üretim MSSQL/Windows, TLS sonlandırıcı ve üretim yükü bu ortamda sınanmadı. Sentetik SQL.js ve tarayıcı sonuçları bunların yerine geçmez. Üretim performans sorunu doğrulanmadı; mevcut kaynak tüketimi sınırları ve yerel testler üretim kapasitesi garantisi değildir.

### Geliştirme sonrası kabul sonucu

`npm run verify` son çalıştırma: **1059/1059 test**, biçim, tip kontrolü ve derleme başarılı (`/tmp/aa-sicil-acceptance.log`). Kapsam: Sicil No çakışması, farklı GUID/kullanıcı adıyla tekrar denemesi, yetkisi kaldırılmış hesap, eksik numara, sahte istemci alanı, eşzamanlı oluşturma, SQL tekil indeksi, eski AD hesabını girişte tamamlama ve AD'de sonradan oluşan çakışmayı reddetme.

Yerel sunucular düzgün biçimde durdurulup iki veritabanı `tmp/sicil-no-oncesi-yedek-20261027` altında özel izinlerle yedeklendi. İki ortam şema 48'e geçirildi, 3000/3001 sağlık kontrolü tekrar 200 döndü. Yedek ile güncel veritabanı karşılaştırmasında migration geçmişi ve geçici oturumlar dışındaki eski sütunların tüm tablo parmak izleri aynı: kullanıcı/parola ve iş kayıtları korunmuş durumda. Ayrıntı: `tmp/sicil-migration-verification.json`.
