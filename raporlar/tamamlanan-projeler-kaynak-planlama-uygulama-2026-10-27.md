# Tamamlanan projeler — kaynak planlama uygulaması

**27.10.2026 · Kullanıcı onayıyla uygulandı.**

## Son davranış

- Kaynak Planlama ilk açıldığında tamamlanan projeler gizlidir. “Tamamlanan projeleri göster” anahtarı solda, “Sadece veri olanlar” seçeneğinin hemen yanındadır.
- Anahtar açılınca projeler mevcut dağılımlarıyla görünür; Proje Bazlı ve Takım Bazlı yerleşimlerde adlarının yanında “Tamamlandı” etiketi bulunur. Görünürlük seçimi veritabanına yazılmaz; sayfa yenilenince başlangıçtaki kapalı duruma döner.
- Gizleme yalnızca tablo satırlarını etkiler. Tamamlanan projelerin geçmiş ve gelecek dağılımları silinmez veya sıfırlanmaz. Dağıtılan/Kalan Kaynak hesabı aynı yetkili veri ve mevcut filtre kapsamıyla çalışır; anahtarı açıp kapatmak toplamları değiştirmez. Diğer raporlardaki kayıtlar korunur.
- Mevcut proje, takım ve “Sadece veri olanlar” filtreleri birlikte çalışır. Yalnızca gizlenmiş tamamlanan projeler seçilmişse, filtreleri silmeden anahtarı açan bir boş durum işlemi gösterilir.
- Kaynak Planlama Excel çıktısı anahtarın açık/kapalı durumuna uyar. Diğer ekranların dışa aktarma kapsamı değiştirilmez.
- Tamamlanan bir projenin hücresinde kaydedilmemiş, kaydetmesi süren veya hata almış değişiklik varsa gizleme engellenir; kullanıcı kaydedebilir veya Escape ile iptal edebilir. Böylece yeni görünürlük seçeneği taslağı kaldırmaz.
- İlk taslaktaki **ileri dönem dağılımı uyarısı**, kullanıcının son talebiyle tamamen kaldırılmıştır. Bu mesaj ve ona ait toplam/tarih hesaplaması son uygulamada yoktur. Kaydedilmiş dağılım verileri korunur.

## Güncel uygulama görselleri

- [Varsayılan kapalı görünüm](gorseller/2026-10-27/kaynak-planlama-tamamlanan-kapali.png)
- [Tamamlanan projeler açık](gorseller/2026-10-27/kaynak-planlama-tamamlanan-acik.png)

Görseller gerçek uygulama kodundan, sentetik veritabanında alınmıştır. Önizlemedeki DOM eklemeleri kullanılmamıştır.

## Doğrulama

- Tam otomatik pakette 1056/1056 test, biçim, TypeScript ve üretim derlemesi başarılı.
- Tamamlanan proje görünürlüğü, toplu hücre girişi/kopyalama, Excel ve diğer ekran dışa aktarmaları, proje durumunu değiştirme ve takım planlama yetkilerini kapsayan 17 hedefli tarayıcı kontrolü geçti.
- Kullanıcının uyarı satırını kaldırma talebinden sonra ilgili yardımcı işlev testleri ve çalışma alanı testleri yeniden çalıştırıldı. Görünürlük/kapasite, iki tablo görünümü, veri filtresi, Excel ve hata alan hücreyi koruma kapsamındaki dört tarayıcı kontrolü son kodla tekrarlandı.
- İki görünümün kapasite özeti aynı kaldı; yalnız açıp kapatma işlemi kayıtlı dağılımları değiştirmedi. Sentetik 503 yanıtı sonrasında tamamlanan proje hücresinin taslağı korundu.
- Gerçek hesap, parola ve iş kayıtları değiştirilmedi; yeni şema/migration gerekmiyor.

Kanıt günlükleri `/tmp/aa-completed-plan-*` altındadır. Önceki [tasarım belgesi](kaynak-planlama-tamamlanan-projeler-tasarim-onizlemesi-2026-10-27.md) uygulama öncesindeki onay sürecinin kaydıdır.
