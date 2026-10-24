# Kullanıcı manueli

## Güncel belge: sürüm 3.1 (24.10.2026)

`AA-Kaynak-Planlama-Sistemi-Kullanici-Manueli-ve-Yetki-Matrisi.pdf` (23 sayfa) güncel arayüzü anlatır: yan menü ve ekran adları, Ana Sayfa, Ctrl+K arama, bildirimler, Projeler ve Proje Takvimi Güncelle (senaryo), Kaynak Planlama, Proje ve Kaynak Değerlendirme (hedef/gerçekleşen plan, ay kilidi, senaryo uyarıları, uyarı ayarları), Haftalık Kritik Konular, Raporlar ve Head Count, Aktivite Giriş, Aktivite Raporu (renk bantları, Excel çıktısı), Organizasyon & Çalışan & Yetki ve rol bazlı yetki matrisi.

### Aktivite yetkileri için kesinleşen kural

Uygulama rolü, aktivite ekranlarının açılabilmesini belirler. Admin dışındaki hesaplarda kişi kapsamı, hesaba bağlı çalışanın organizasyon görevinden gelir; Yönetici (`manager`) rolü veya planlama liderliği atamaları (`user.leaders`) bu kapsamı genişletmez.

| Çalışan görevi | Aktivite Giriş ve izin/eğitim | Aktivite Raporu |
|---|---|---|
| Team Member / CoE | Yalnız kendisi | Kendi takımı |
| Product Owner | Kendisi ve kendi takımı | Kendisi ve kendi takımı |
| Lider | Kendisi, kendi liderliği, alt liderlikler ve bağlı takımlar | Aynı kapsam |
| Admin (uygulama rolü) | Herkes | Herkes |

Çalışan kaydıyla eşleşmemiş Admin dışındaki hesaplar, Yönetici rolünde ve planlama için liderlik yetkisi olsa da her iki aktivite ekranında boş sonuç görür. Bu durum bir yetki hatası değildir. Admin, hesap-çalışan eşleşmesini ve organizasyon görevini kontrol etmelidir.

PDF'nin kapak tablosunda yalnız belge sürümü ve tarih bulunur. Ana Sayfa görseli, kartların detay açıklamaları kaldırılmış haliyle güncellenmiştir.

**3.1 doğrulaması (24.10.2026):** HTML'den PDF yeniden üretildi. PDF 23 sayfa; sürüm, kapaktan kaldırılan satırlar, aktivite yetki metni ve metin sınırları otomatik kontrol edildi. Tüm sayfalar PNG'ye dönüştürülüp görsel olarak incelendi; rol kapsamı ve yetki matrisi ayrıca yakın görünümde kontrol edildi. Güncel uygulamanın doğrulama sonucu 1015/1015 test ve başarılı derleme/dağıtım kontrolüdür; tam UI ve native MSSQL koşuları ayrı takip işidir.

`v3/` klasörü kaynakları içerir:

- `manual.html`: belge metni ve sayfa düzeni (IBM Plex Sans, `frontend/assets/fonts` altından).
- `shots/`: PDF'de kullanılan ekran görüntüleri (JPEG).
- `server.mjs`: demo veritabanının **geçici kopyasını** açar, ekran görüntüsü hesaplarını ekler (`sistem.admin`, `proje.ofisi`) ve kopyada `genel.mudur` ile `muhendis.detay` şifrelerini ayarlar. Kopya iş bitince silinir.
- `shots.mjs`: `server.mjs` ile kopyayı başlatıp tüm ekran görüntülerini PNG olarak alır.
- `pdf.mjs`: `manual.html` dosyasını Chrome ile A4 PDF'e dönüştürür.

Yeniden üretme (proje kökünde):

1. `node docs/kullanici-manueli/v3/shots.mjs <çıktı-klasörü>` (başka bir demo dosyası için önüne `MANUAL_DB=<dosya.sqlite>` ekleyin).
2. Görüntüleri JPEG'e çevirip `v3/shots/` altına koyun (macOS: `sips -s format jpeg -s formatOptions 82 x.png --out v3/shots/x.jpg`).
3. `node docs/kullanici-manueli/v3/pdf.mjs <çıktı.pdf>`.

Gerçek veritabanına (`data/planlama.sqlite`) ve canlı demo dosyasına bu adımlarda yazılmaz. `v2/` önceki sürüm 2.x kaynaklarıdır.

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
