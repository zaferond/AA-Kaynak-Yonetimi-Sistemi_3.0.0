# Sağlık kontrolü ve senaryo düzenleme düzeltmeleri — 27.10.2026

Kullanıcının istediği D-01 ve T-01 bulguları giderildi. Gerçek parolalar, hesap yetkileri ve iş kayıtları değiştirilmedi.

## D-01 — Sağlık kontrolünde biriken DB işleri

`backend/health-check.mjs`, uygulama örneği başına yalnızca bir sağlık DB kontrolü yürütür. Eşzamanlı HTTP istekleri aynı sonucu paylaşır. HTTP yanıtı beş saniyede 503'e dönse veya istemci ayrılsa da mevcut DB işi tamamlanana kadar yeni kontrol başlatılmaz. DB işi sonuçlanınca slot bırakılır; geç gelen hata da yakalanır. Başarılı/başarısız sonuçlar bir saniye önbellekte tutulur; süre hesabı monoton saat kullanır. Sağlık yanıtı oturumsuz, ayrıntısız ve `no-store` olarak kalır.

**Doğrulama:** Gerçek DB'den bağımsız HTTP testinde 12 eşzamanlı istek ve bağlantısını kesen ek istemci aynı tek DB işini paylaştı. Yanıtlar zaman aşımıyla 503 olduktan sonra gönderilen 12 yeni istek de yeni DB işi başlatmadı; sorgu sayısı 1 kaldı. Bekletme kaldırılınca sağlık yanıtı 200'e döndü. Önbellek süresi dolunca yeni sorgu açılması, geç hata, senkron hata ve iyileşme ayrıca test edildi. Sürücüde çalışmakta olan sorgu zorla iptal edilmiyor; iş bitene kadar yeni sağlık sorgusu başlatılması engelleniyor.

## T-01 — Düzenle kartındaki Senaryo İsmi

İsim kutusu masaüstünde butonlardan kalan genişliğe göre küçülür; 160 px minimum sınırı kaldırıldı. Küçük ekranda boşluklar azaltıldı, dekoratif ok gizlendi ve dar isim kutusu işlem butonlarıyla aynı satıra sığdırıldı. 390 px genişlikte Kaydet, Kopyala, Vazgeç ve isim girişi yatay kaydırmadan görünür. Çok dar 320 px ekranda kontroller taşmadan alt satıra geçer. Yeni senaryo kartı da yatay kaydırma gerektirmez.

**Doğrulama:** Düzenle açıldıktan sonra 1600, 1366, 1280, 1024, 768, 390 ve 320 px genişliklerde isim alanına yazıldı; alanın ve butonların kart sınırları içinde kaldığı ölçüldü. 390 px ve üzerindeki düzenleme satırı aynı hizada kaldı. İptal, aynı kaydı güncelleme, kopya engeli, uzak değişiklikte revision çatışması ve onaylı kaydı düzenleyememe kontrolleri geçti. Görsel kontrol sentetik verilerle yapıldı.

## Sonuçlar

- 1053/1053 otomatik test başarılı. Son monoton saat değişikliğinden sonra ilgili 6 sağlık testi tekrar geçti; biçim, TypeScript ve üretim derlemesi başarılı.
- 10/10 hedefli tarayıcı kontrolü başarılı; düzenleme, dar ekran, kayıt/iptal/çakışma, senaryo kartı ve tamamlanan projeler kapsamı.
- 3000 ve 3001 güncel kodla yeniden başlatıldı; iki ortamda sayfa ve sağlık 200. Her portta 12 paralel sağlık isteğinin tamamı 200 döndü.
- Güncel dağıtım envanteri kaynak ve arayüz çıktılarıyla birlikte üretildi.

Kanıt günlükleri: `/tmp/aa-health-layout-*`. Bu tur tüm 339 tarayıcı kontrolü tekrar edilmedi; değişen senaryo ekranlarının hedefli paketi çalıştırıldı. Önceki tam paket sonucu [inceleme raporunda](son-guvenlik-mimari-performans-arayuz-incelemesi-2026-10-27.md) korunur. Gerçek kurum MSSQL/AD yük kabulü bu yerel doğrulamanın kapsamı değildir.

Yüksek öncelikli G-01 (aktif yönetici parolası) ve B-01 (kılavuzun güncellenmesi) açık kalır.

## Ek düzenleme — Senaryo İsmi ve rapor görünümü

Büyütülmüş masaüstü görünümünde isim kutusunun 20 px'e kadar sıkışabildiği yeniden üretildi. İsim alanına kullanılabilir minimum yer ayrıldı; kart daraldığında işlem satırı gerektiğinde bölünüyor. Girişin yüzde genişliği ile flex genişliğinin çakışması kaldırıldı. Tarayıcı kontrolü artık alana yazmadan ve yatay kaydırmayı sıfırladıktan sonra kart/ekran sınırlarını ölçüyor; 1, 1,1 ve 1,25 ölçeklerinde 1366, 1280, 768, 390 ve 320 px genişlikleri de kapsıyor. Güncel senaryo düzenleme, yerleşim ve tamamlanan proje paketindeki 10 kontrol geçti.

Raporlar sekmesindeki “Senaryoları Sil” düğmesinin adı “Kaldır” yapıldı. Mevcut onay ve yalnız rapor görünümünden kaldırma davranışı korunur; kayıtlı senaryo silinmez. Son üretim derlemesi ve dağıtım doğrulaması başarılı.
