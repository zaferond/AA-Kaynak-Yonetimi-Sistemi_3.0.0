# Ürün ve tasarım kararları

Bu liste, bilerek seçilmiş davranışları tek yerde tutar. Buradaki maddeler inceleme sırasında hata olarak yeniden açılmaz. Bir kararı değiştirmek için önce bu dosyada karar güncellenir, sonra kod, test ve kullanıcı manueli aynı değişiklikte eşitlenir.

Her madde: tarih, karar, gerekçe ve kodda uygulandığı yer.

## Kimlik ve hesaplar

**K-01 · Gerçek kullanıcılar AD ile girer (28.10.2026).** Yerel hesaplar yalnız testlerde ve ilk kurulumdaki root-admin için kullanılır. Yerel hesaplara yönelik kullanıcı deneyimi geliştirmesi (örneğin menüden şifre değiştirme) yapılmaz.

**K-02 · İlk yönetici şifresi diske yazılmaz (28.10.2026).** `ADMIN_PASSWORD` boşsa sunucu ilk açılışta konsola tek kullanımlık kurulum kodu basar. İlk girişte kendi şifrenizi belirlemeniz zorunludur. Şifre belirlenene kadar her açılışta yeni kod üretilir ve eski kod geçersiz olur. Eski kurulumlarda `ADMIN_PASSWORD` hâlâ okunur; hesap oluştuktan sonra satır kalırsa uyarı verilir.
Gerekçe: G-01 (açığa çıkmış yönetici parolası). Kod: `backend/root-admin-bootstrap.mjs`.

**K-03 · Kullanıcı adı tekil hesap anahtarıdır; Sicil No toplanmaz (27.10.2026).** Pasif veya yetkisi kaldırılmış hesaplar da kullanıcı adını rezerve tutar. Aynı AD kimliği (GUID) ikinci hesaba bağlanamaz.
Gerekçe: M-03, eksik numaralı eski hesap bütün eşleştirmeleri durduruyordu.

## Yetki ve görünürlük

**Y-01 · Aktivite kişi kapsamı kaynak görevinden gelir.** Yönetici (`manager`) rolü ve planlama liderliği (`user.leaders`) bu kapsamı genişletmez. Kod: `shared/actual-entry-access.ts`.

**Y-02 · Proje ve Kaynak Değerlendirme Raporu tüm Yönetici hesaplarına portföy görünümüdür (28.10.2026 teyit).** `projectProgress` ve `progressLocks`, gizli projeler dışında liderlikten bağımsız okunur. Hedef plan ve gerçekleşen girişi sunucuda `user.leaders` ile sınırlıdır.
Kod: `shared/access.ts` (`scopeData`), `backend/progress-commands.mjs`.

## Hedef plan ve gerçekleşen

**H-01 · Gerçekleşen yalnız tamamlanmış aylara girilir (27.10.2026; sunucu 28.10.2026).** Örneğin Ekim, 1 Kasım'da açılır. Değerlendirme raporu içinde bulunulan ayı görüntülemeye devam eder. Kural tek fonksiyondadır ve arayüz ile sunucu aynı fonksiyonu kullanır.
Kod: `shared/project-progress.ts` (`lastActualEntryMonth`).

**H-02 · Hedef revizyonunda öneri gerçekleşeni aşmaz (23.10.2026).** Gerçekleşen girilmiş aylarda öneri gerçekleşenin kendisidir. Sonraki aylar son gerçekleşenden %100'e yeniden dağıtılır. Revizyonlarda kilitli aydan sonraki ilk hedef, kilitli ayın donmuş hedefinden küçük olabilir. Kilitten sonra eğri azalmaz. İlk planlarda bu istisna yoktur.
Kod: `suggestRevisionTargets` ve `proposalProblems` (`lockedThrough`).

**H-03 · Tamamlanan projeler ilerleme ay şeridini genişletmez (28.10.2026).** Ay satırında bu yıl ve önceki yıl açık görünür. Daha eski yıllar "Önceki yıllar (n)" düğmesinin arkasındadır. Seçili ayın yılı her zaman görünür kalır.
Kod: `frontend/src/features/project-progress/progress-months.ts`.

## Ekran davranışı

**E-01 · Kaydedilmemiş taslak varken satır görünümü değişmez (27–28.10.2026).** Kaydedilmemiş, kaydı süren veya hata almış bir hücre varken "Sadece Veri Olanlar" ve "Tamamlanan Projeleri Göster" görünümü değiştirmez. Bu kural Kaynak Planlama ve Aktivite Giriş'te geçerlidir. Kullanıcı ya kaydeder ya da Escape ile açıkça iptal eder. Görünür Dönem değişimi ve Filtreleri Sıfırla açık taslağın satırını ekranda tutar.
Kod: `frontend/src/features/workspace/useViewChangeGuard.ts`. Yeni bir satır görünürlüğü kontrolü eklendiğinde bu hook kullanılmalıdır.

**E-02 · Tamamlanan projeler varsayılan olarak gizlidir, silinmez.** Kaynak Planlama ve Aktivite Giriş'teki seçimler birbirinden bağımsızdır. Toplamlar, kapasite ve sunucu sınırları gizli projeleri de kapsar.
