# Kullanıcı manueli ve yetki matrisi

## Güncel belge: sürüm 3.4 (28.10.2026)

- **Kullanıcı Manueli ve Yetki Matrisi:** `AA-Kaynak-Planlama-Sistemi-Kullanici-Manueli-ve-Yetki-Matrisi.pdf`, 30 sayfa.
- **Ayrı Yetki Matrisi:** `AA-Kaynak-Planlama-Sistemi-Yetki-Matrisi.pdf`, 3 sayfa. Aynı HTML kaynağından üretilir; ekran erişimi, işlem yetkileri ve aktivite kişi kapsamını içerir.
- Paylaşım kopyaları: proje kökündeki `output/pdf/AA-Kullanici-Manueli-ve-Yetki-Matrisi-3.4.pdf` ve `output/pdf/AA-Yetki-Matrisi-3.4.pdf`.

Güncel uygulamadan alınan **34 ekran görüntüsü** kullanılır. Kaynak, yayımlanan `46131ab` üzerine kullanıcı isteğiyle yapılan hedef/gerçekleşen filtre ve sekme sayacı geliştirmelerini de kapsar. Belge güncellemesi uygulamadaki açık inceleme bulgularını kapatmaz; [yeniden inceleme raporu](../../raporlar/yayin-sonrasi-guvenlik-mimari-tasarim-incelemesi-2026-10-27.md) esas alınır.

### Kapsanan son değişiklikler

3.4 sürümünde eklenenler (`85f5a64`):
- Kaynak Planlama'da kaydedilmemiş, kaydı süren veya hata almış hücre varken Sadece Veri Olanlar ve Tamamlanan Projeleri Göster görünümü değiştirmez; kaydetme veya Escape ile iptal istenir.
- Hedef/gerçekleşen ay satırında yalnız bu yıl ve önceki yıl açık görünür; eski yıllar Önceki yıllar (n) düğmesindedir. Tamamlanan projeler ay satırını genişletmez.
- Geçici parola notuna kullanıcı adı ve belgelerde/kaynak kodda yer almış değerlerin kabul edilmediği eklendi.
- Yetki matrisinde yetki değişikliği yoktur; yalnız sürüm ve tarih güncellendi. Ekran görüntüleri 3.3 ile aynıdır.

- AD kullanıcı seçimi ve otomatik hesap eşleştirmesi. Tekrar kayıt kontrolü kullanıcı adı üzerinden yapılır; aynı AD kimliği de ikinci hesaba bağlanamaz.
- Aktif/Pasif İlan'da hesap tanımlanmaması, bekleyen AD seçiminin ilan statüsünde temizlenmesi.
- Proje Durumu / Tamamlandı, Tamamlanan Projeler sekmesi ve Kaynak Planlama'da tamamlanan projelerin isteğe bağlı gösterilmesi.
- Senaryo Oluştur ile açılan kart, Senaryo Ekle sonrası kapanma, kayıtlı senaryoyu Düzenle/Kaydet, toplu silme, Onaylanan Takvim Güncellemeleri ve Raporlar'daki Kaldır ayrımı.
- Başlık ve Detaylar / Görünüm yan paneli, ayrı detay tarihleri, milestone ve güncel haftalık kritik konu görünümü. Hafta seçimleri: Tüm Haftalar, Geçen Hafta, Bu Hafta, Gelecek Hafta ve Hafta Ekle.
- Kaynak Planlama ve Aktivite Giriş seçimleri: Sadece Veri Olanlar ve Tamamlanan Projeleri Göster.
- Aktivite Giriş'te tamamlanan projelerin varsayılan gizlenmesi, isteğe bağlı gösterilmesi; Proje/Kişi Bazlı görünüm ve Excel uyumu, aylık toplam/kapasitenin korunması.
- Hedef/gerçekleşen girişinde tek seçimli bekleyen iş filtreleri; yalnız gerçekleşen giriş ve değerlendirme seçiminde açılan ay satırı. Değerlendirme seçimi varsayılan işlem ayına döner. Giriş sekmesinde yalnız tamamlanmış aylar seçilir: Ekim, 1 Kasım’da açılır; raporda mevcut ay seçimi korunur.
- Giriş sekmesinin yanındaki turuncu hedef plan ve mavi gerçekleşen giriş sayıları; büyük özet kartları kullanılmaz. Sayılar yetkili birim, liderlik/proje sorumlusu ve ay kapsamında hesaplanır.
- Önerilen hedef uygulandıktan sonra bir ay değişirse o ay dışındaki önceki/sonraki düzenlenebilir ayların yeniden hesaplanması; kilitli ayların korunması.

### Yetki ayrımı

Uygulama rolü ekran erişimini belirler. Admin dışındaki hesaplarda aktivite kişi kapsamı kaynak görevinden gelir; Yönetici (`manager`) rolü ve planlama liderliği (`user.leaders`) bu kapsamı genişletmez.

| Çalışan görevi | Aktivite Giriş ve izin/eğitim | Aktivite Raporu |
|---|---|---|
| Team Member / CoE | Kendisi | Kendi takımı |
| Product Owner | Kendi takımı ve kendisi | Kendi takımı ve kendisi |
| Lider | Kendi liderliği, alt liderlikler, bağlı takımlar ve kendisi | Aynı kapsam |
| Admin (uygulama rolü) | Tüm çalışanlar | Tüm çalışanlar |

Normal-Proje hesabı proje/haftalık kritik konu ekranlarını yönetir; aktivite ekranlarını açmaz. Tamamlandı işaretleme ve yeniden aktif yapma Admin/Normal-Proje; AD/kullanıcı adı ile hesap eşleştirme yalnız Admin işlemidir. Yeni hesaplarda tekrar kontrolü kullanıcı adına göre yapılır; numara bilgisi toplanmaz. AD bağlantısını IT yapılandırır; kimlik bilgileri kurumsal dizinden alınır.

### Görsel ve içerik doğrulaması

İki PDF'nin tüm sayfaları PNG'ye dönüştürülüp gözden geçirildi. Taşan tek satırlı sayfalar ve bölünen matris düzeltildi; Türkçe karakterler, görsel dosyaları, sürüm/tarih ve 30/3 sayfalık son düzen doğrulandı. Kapakta yalnız belge sürümü ve tarih vardır; uygulama durumu/önceki sürüm/ekran görüntüsü satırları eklenmez.

3.4 doğrulaması (28.10.2026): 1065/1065 otomatik test ve 3/3 Kaynak Planlama taslak koruması tarayıcı kontrolü başarılı; 30 ve 3 sayfalık PDF'lerin tüm sayfaları görsel olarak incelendi. Önceki uygulama doğrulaması: 1062/1062 otomatik test ve tam pakette 366/366 tarayıcı kontrolü başarılı. M-01 taslak koruması, M-02 AD/takım seçim sırası ve Q-01 eski test akışı bulguları kapandı. Altı yeni planlama regresyonu tam pakete dahildir. Gerçek kurumsal AD ve native Windows/MSSQL kabulü bu yerel doğrulamadan ayrıdır; G-01 parola yenileme bulgusu inceleme raporunda açık kalır.

### Kaynaklar ve yeniden üretme

`v3/manual.html` güncel ana kaynaktır. `v3/build-matrix.mjs` aynı kaynaktan `yetki-matrisi.html` üretir; `v3/pdf.mjs` PDF'ye çevirir. `v3/shots/` kullanılan JPEG görsellerini içerir. `v2/` ve aşağıdaki 1.1 belgeleri arşivdir.

1. `node docs/kullanici-manueli/v3/shots.mjs tmp/manuel-shots` ile ekran görüntülerini alın. İstenirse son argümanda `giris,admin,yonetici,normal,normalproje,baslik,degerlendirme,aktivite,hesap,planlama,kritik` grupları seçilebilir.
2. PNG'leri JPEG'e dönüştürüp `v3/shots/` altına koyun (örneğin macOS `sips -s format jpeg -s formatOptions 88 <kaynak.png> --out <hedef.jpg>`).
3. Kapaktaki **Belge sürümü** ve **Tarih** satırlarını güncelleyin; üstbilgi ve yetki matrisi sürümü buradan okunur.
4. `npm run docs:manual` çalıştırın. Komut yetki matrisini çıkarır, iki PDF'i üretir ve `output/pdf` altındaki sürümlü paylaşım kopyalarını yeniler. Her `.page` bölümü tek sayfaya sığmalıdır; sığmayan bölüm olursa komut bölüm başlıklarıyla hata verir.
5. PDF sayfalarını görsel olarak gözden geçirin (görsel kırpması, tablo okunurluğu).

`server.mjs`, `data/demo-sunum.sqlite` dosyasının **geçici kopyasını** kullanır. Ekran görüntüsü hesapları ve AD örnekleri yalnız bu kopyaya eklenir; kurumsal LDAP bağlantısı kurulmaz. Giriş parolaları ve oturum uyarısı zamanı yalnız kopyada değişir. İş bitince kopya silinir. Canlı demo ve asıl planlama dosyalarına yazılmaz. Başka bir demo kaynağı için `MANUAL_DB=<dosya.sqlite>` kullanılabilir.

## Önceki belge: sürüm 1.1

**Sürüm 1.1 / 15.10.2026.** PDF, kapak ve içindekiler dahil 9 sayfadır. Günlük kullanım 1-6. bölümlerde; sorun giderme ve IT bilgileri 7. bölümdedir. Bu sürüm kısa işlem adımları ve tablolar kullanır; eski ekran görüntülerini içermez.

- `AA-Kaynak-Planlama-Sistemi-Kullanici-Manueli.md`: düzenlenebilir Türkçe kaynak.
- `AA-Kaynak-Planlama-Sistemi-Kullanici-Manueli.pdf`: paylaşılacak belge.
- `build_manual.py`: Markdown kaynaktan PDF üretir. Veritabanına veya uygulamaya bağlanmaz.
- `assets/`: önceki belge sürümünün sentetik görselleri; güncel PDF'de kullanılmaz.

## Yeniden üretme

1. Markdown metnini düzenleyin; düğme adlarını ve davranışları güncel kodla karşılaştırın.
2. Dosyanın üst bilgisinde sürüm, tarih, uygulama sürümü ve kaynak commit'i güncelleyin. Kapak ve üstbilgi bu bilgilerden otomatik üretilir.
3. Python 3.9+ ile ayrı ortam oluşturun: `python -m venv .venv`.
4. Ortamı etkinleştirip `python -m pip install -r requirements.txt` çalıştırın.
5. Bu klasörde `python build_manual.py` çalıştırın.
6. PDF'yi yeniden açın; Türkçe karakterleri, içindekileri, sayfa numaralarını ve tüm sayfaların görünümünü kontrol edin.

Türkçe destekli Arial (macOS/Windows) veya DejaVu Sans (Linux) gerekir. Özel font dizini `AA_MANUAL_FONT_DIR` ile seçilebilir. Beklenen dosyalar: Arial.ttf, Arial Bold.ttf, Arial Italic.ttf, Arial Bold Italic.ttf. Fontlar lisansları nedeniyle pakete eklenmez. `---page---` işaretleri PDF'de sayfa sonudur.

## Doğrulama kaydı (sürüm 1.1 arşivi)

**İncelenen uygulama commit'i:** `38b5f48abb83dc3c6827d98e13f5fa0eefd5ec6d`. Bu commit, soluk aşama renklerini, sola hizalamayı ve özet tablonun boş/açık renkli köşe başlığını içerir.

| Alan | Karşılaştırılan kaynaklar |
|---|---|
| Ekranlar, roller, filtreler | `frontend/src/settings.ts`, `features/WorkspaceNavigation.tsx`, `WorkspaceFilters.tsx`, `shared/access.ts` |
| Gerçekleşen, izin/eğitim, aktivite | `PersonAllocationPanel.tsx`, `WorkCalendarDialog.tsx`, `features/work-calendar/`, `shared/actual-months.ts`, `shared/activity-report.ts` |
| Planlanan dağılım ve yetkiler | `features/planned-allocation/`, `features/access/planning-permission-tree.ts`, `shared/access.ts` |
| Projeler ve kritik konular | `ProjectTimelineRows.tsx`, `MilestoneDateEditor.tsx`, `ProjectInfoReport.tsx`, `features/editors/`, `phase-chip.ts` |
| Çalışan ve organizasyon | `features/editors/ResourceEditorFields.tsx`, `features/access/AccessPermissionFields.tsx`, `shared/resource-roles.ts` |
| Kaynak raporları ve ilan işlemi | `features/resource-reports/`, `features/workspace/ActivePostingPlanningToggle.tsx`, `active-posting-changes.ts` |
| IT işletimi | `package.json`, `README.md`, AD/dağıtım/Windows/yedekleme kılavuzları |

`frontend/src/` altındaki kısa dosya yolları yukarıda bu köke göredir. `shared/` ve proje kökündeki yollar ayrıca belirtilmiştir.

### Bu güncellemede çalıştırılan kontroller

- `npm run build`: tip kontrolü ve arayüz derlemesi başarılı.
- Değişen frontend dosyalarında Prettier ve `git diff --check`: başarılı.
- `node --test tests/editor-commands.test.mjs tests/team-planning-permissions.test.mjs tests/active-posting-planning.test.mjs tests/headcount-report.test.mjs`: **38/38 başarılı**. Veriler sentetiktir; Store kullanan testler geçici SQL.js dosyası açar.
- Geçici tarayıcı ortamında özet başlığının kaldırılması, açık zemin, kaynak satırlarının korunması, gerçekleşen varsayılanının 24 ay olması ve Yönetici/Normal Kullanıcı menü kapsamı doğrulandı. Gerçek hesapla giriş yapılmadı.
- Önceki arayüz çalışmasında aşama renkleri ve sola hizalama, üç sekmede ve planlamanın iki görünümünde ayrıntılı/kompakt/genel bakış modlarında kontrol edildi. Bu, genel performans veya güvenlik kabulü değildir.
- PDF, pypdf/PyMuPDF ile yeniden açıldı; 9 sayfa, 7 bağlantılı bölüm, sayfa sınırları ve Türkçe metin kontrol edildi. Bütün sayfalar görüntüye dönüştürülerek görsel olarak incelendi.

### Kaynaklarda bulunan farklar ve kurum teyidi

Eski belgelerde İK Notu, Bilgi Ekle, ayrı AD yetkilendirme düğmesi, 12 aylık gerçekleşen başlangıcı ve eski grafik adları bulunur. Manuel güncel arayüzü esas alır. Kişi Eşdeğeri formda gizlidir; CoE takım rolü vardır; plan yetkisi takım bazında da verilir. Eski teknik kılavuzlardaki tarihsel ekran adları güncel kullanım talimatı olarak alınmamalıdır.

Gerçek AD/MSSQL/Windows servisi, kurum adresi, HTTPS/proxy, tarayıcı kabulü, yük ve tam geri yükleme bu belge hazırlığında denenmedi. Destek sorumlusu, dağıtılacak paket, çalışma takvimi ve kurum kabulü IT/ürün sahibi tarafından teyit edilmelidir. Gizli ayar, parola ve gerçek çalışan bilgisi belgeye eklenmemelidir.
