# Kaynak / AD eşleştirmesi ve proje durumu — 27.10.2026

## Uygulanan akış

- Aktif İlan ve Pasif İlan statülerinde AD araması ve hesap tanımlama alanları gösterilmez; “İlan kaydına hesap tanımlanamaz.” açıklaması görünür. Kaydedilmemiş AD seçimi ve hesap oluşturma isteği temizlenir. Arka plandaki AD liste yanıtları kapatılan alana uygulanmaz.
- Diğer statülerde, henüz hesabı eşleştirilmemiş kaynak için Active Directory otomatik açılır. “Hesap tanımlama” / boş seçim ve ayrıca AD seçme adımı kaldırılmıştır. AD kullanıcısı seçilmeden bu ekrandan yeni çalışan/hesap kaydı tamamlanamaz. Bağlantı yoksa yapılandırma mesajı gösterilir.
- Kurumda tanımlı dizin ve varsa grup kapsamındaki kullanılabilir AD kullanıcıları listelenir. Arama, ad soyad, kullanıcı adı veya e-posta ile yapılır. En fazla ilk 50 sonuç getirilir; daha fazla sonuç varsa aramayla daraltılır. Mevcut uygulama hesabı olan kişiler yeniden oluşturulamaz; mevcut kaydın Düzenle ekranından yönetilir.
- **Kullanıcı Ara** listeyi filtreler/yeniler. Kullanıcı satırındaki **Seç**, kimliği forma taşır; seçilen satır **Seçildi** olur. Ad soyad, kullanıcı adı ve e-posta AD'den gelir ve salt okunurdur. Seçim anında kayıt oluşmaz; “Henüz kaydedilmedi” bilgisi görünür.
- **Kaydet**, çalışan kaydı ve hesap/rol eşleştirmesini tek atomik işlemde kaydeder. AD kullanıcısı kayıtta yeniden doğrulanır. Hata veya sürüm çatışmasında kısmi çalışan/hesap oluşmaz. AD parolası bu ekranda oluşturulmaz/değiştirilmez; girişte kurumsal hesap kullanılır.
- Var olan hesapların kimlikleri ve yetki kaldırma onayı korunur; statü seçimi gerçek bir hesabı kendiliğinden silmez veya kapatmaz. Yeni varsayılan AD taslağı, henüz kişi ve özel yetki kapsamı seçilmemişken takımın türettiği liderliği takip eder.

## Görseller

Görseller gerçek uygulama arayüzünden, geçici veritabanı ve temsili AD kullanıcılarıyla alınmıştır. Kurum dizinine bağlanılmadı; gerçek kullanıcı bilgileri ve parolalar kullanılmadı.

1. [Arama listesi](gorseller/2026-10-27/ad-01-kullanici-listesi.png)
2. [Seçim sonrası salt okunur bilgiler](gorseller/2026-10-27/ad-02-kullanici-secildi.png)
3. [Kaydet sonrasında çalışan ve AD hesabı](gorseller/2026-10-27/ad-03-kayit-sonrasi.png)
4. [Proje Durumu / Tamamlandı kutusu](gorseller/2026-10-27/proje-durumu-tamamlandi.png)

## Proje durumu

Tamamlandı seçimi, Görüntüleme Yetkisi ile aynı çerçeve ve arka plan stilindeki **Proje Durumu** kutusuna alındı. Onay kutusu ve Tamamlandı yazısı yatay hizalıdır. Kaydet sonrasında projeyi Tamamlanan Projeler sekmesine taşıma ve işareti kaldırınca geri getirme davranışı korunur.

## Doğrulama

- 1053 otomatik test başarılı; TypeScript ve üretim derlemesi başarılı.
- Yeni statü/AD taslağı kontrolü ve çalışan yetkileri, AD admin rolü, erişim, proje durumu, kaynak görevleri ve takım bazlı kaynak kayıtları için 41 hedefli tarayıcı kontrolü başarılı.
- Yeni test; AD seçildikten sonra her iki ilan statüsüne geçişi, diğer statülerde AD'nin açılmasını, ilanda kaydederken hesap isteği gönderilmemesini ve kullanıcı sayısının değişmemesini kontrol eder. Son doğrulamada AD seçilmeden kaydetme mesajı da kontrol edildi.
- Arama → Seç → Kaydet örneği ayrıca uçtan uca çalıştırıldı; çalışan ve LDAP hesabı oluştu, arayüzde JavaScript hatası görülmedi.
- Gerçek kurum AD/LDAPS ve MSSQL kabulü sentetik testin kapsamı değildir. Gerçek veritabanları, hesaplar ve parolalar değiştirilmedi.

Kanıt günlükleri: `/tmp/aa-resource-status-*`.

## Kullanıcı seçimi renkleri

Kullanıcı listesi güncel teknik temanın mavi/gri renklerine uyarlandı. Beyaz liste zemini, ortak çerçeve/ayraç renkleri, açık mavi seçili satır ve koyu mavi seçim işareti kullanılıyor; eski yeşil metinler değiştirildi. Her kaynak için tek bir AD kimliği seçilir. Başka bir kullanıcı seçilince önceki seçim değiştirilir; kaydedilene kadar veritabanına yazılmaz. Görsel örnekleri yeni renklerle yenilendi.
