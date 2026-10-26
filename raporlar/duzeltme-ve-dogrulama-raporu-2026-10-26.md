# Düzeltme ve doğrulama raporu — 26.10.2026

## Kapsam

Kullanıcının istediği beş orta/düşük öncelikli bulgu giderildi. Önceki turda hazırlanan üç geliştirme de bu yayın kapsamındadır: Senaryo Oluştur ile açılan kart, önerilen hedefin iki yönde yeniden dağıtılması ve Tamamlanan Projeler sekmesi.

Aktif yönetici parolasına ilişkin S-01 bulgusu **açıktır**. Bu tur gerçek parolalar değiştirilmedi. Kod ve dağıtım paketi, şema 47 ile birlikte ele alınmalıdır; kurum MSSQL ortamında yayın öncesi `npm run db:migrate` gerekir. İş kayıtları ve hesaplar silinmez.

## Kapanan bulgular

| Bulgu | Değişiklik | Doğrulama |
|---|---|---|
| S-02 — Oturum kotası | `/api/auth/activity` mevcut `admission.handler` içine alındı. Yürütme boyunca slot korunur ve kuyruk sonrası kimlik doğrulaması uygulanır. | İlk etkinlik işi bekletilip istemcisi ayrıldı. Slot 1 olarak kaldı; ikinci iş 503 ile reddedildi. İlk iş bitince normal etkinlik 200; iş generation'ı değişmedi. |
| L-01 — Filtrelerde taslak kaybı | Liderlik, hedef/gerçekleşen durumu, bekleyen işler, sorumlu ve filtre sıfırlamada mevcut taslak bırakma onayı kullanılır. Açık ay değiştirmeye ilişkin kabul edilmiş davranış değiştirilmedi. | Plan, gerçekleşen, sorumlu, bekleyen iş ve sıfırlama işlemleri iptal edildiğinde 37 ve açıklama korundu. Açık kabul sonrası kart gizlendi; DB'ye örtük kayıt yazılmadı. |
| L-02 — Aksiyon taslağı kaybı | Açıklama, sorumlu, hedef tarih ve açılış revision'ı her uyarı için ayrı saklanır. Sayfa/sekme bırakma korumasına katılır. Vazgeç yalnız ilgili taslağı siler. | A → B → A üç alanı korudu. Sekme bırakma iptali çalıştı. Uzak değişiklikten sonraki kaydetme 409 verdi, taslak korundu; diğer uyarının taslağı silinmedi. |
| U-01 — Çalışmayan kapatma | Kontrollü oturum uyarısının etkisiz X simgesi kaldırıldı. Devam/dönüş ve çıkış eylemleri korundu. | Masaüstü ve 390 × 844 boyutunda ölü Close kontrolü yok. Açık dönüş düğmesi çalışıyor; mutlak bitiş tarihi değişmiyor. |
| P-01 — Kullanılmayan gzip | `backend/static-site.mjs` ile hazır gzip seçimi eklendi. Ham karşılık, doğru MIME, Vary, ayrı ETag, HEAD ve HTML/hash'li dosya önbelleği korunur. | gzip ve identity yanıtları, gzip;q=0, başlıksız istemci, eksik gzip dosyasına ham dönüş, HEAD, 304 ve dosya yolu/dotfile engelleri başarılı. |

## Önceki geliştirmelerin yayına dahil edilmesi

- Senaryo kartı başlangıçta kapalıdır; Senaryo Oluştur açar. Başarılı ekleme/düzenleme kartı kapatır; hata taslağı açık bırakır. Kayıtlı taslaklar Düzenle ile açılır, kullanıcıya göre oturum taslakları korunur.
- Önerileni Uygula sonrasında değiştirilen hedef ayı sabittir; önceki ve sonraki düzenlenebilir aylar kaynak ağırlıklarıyla yeniden hesaplanır. Onaylı kilitli geçmiş korunur; son hedefin %100 olma doğrulaması sürer.
- Proje Bilgilerini Düzenle içindeki Tamamlandı alanı `kp_projects.completed` üzerinden kalıcıdır. Aktif ve tamamlanan projeler aynı takvim görünümünde ayrı sekmelerdedir. İşaret kaldırılırsa proje aktif listeye döner. Proje düzenleme yetkileri ve diğer raporlardaki tarihsel kayıtlar korunur.
- Şema 47 SQL.js ve MSSQL migration dosyalarıyla eklenmiştir. Eski projelerin varsayılanı aktif kalır. Migration, kayıt/revision korunması ve yetkisiz durum değişiminin reddi test edildi.

## Kontroller

- Otomatik testler: 1050/1050 başarılı; biçim, TypeScript ve üretim derlemesi başarılı.
- Tam izole tarayıcı paketi: 339/339 başarılı (izole tüm fixture kontrollerinin toplamı).
- Temiz 4.0.0 bağımlılık kurulumu ve üretim derlemesi: başarılı.
- Dağıtım envanteri, kaynak eşleşmesi ve sır deseni kontrolü: başarılı; 4.0.0 paketinde 578 kaynak ve 76 güncel çıktı; uygulamaya ait 563 dosyanın hash değerleri geliştirme kaynağıyla eşleşti.
- Yerel 3000/3001 ve gerçek paket başlangıcı: başarılı; iki portta gzip yanıtları açıldığında ham JS/CSS ile eşleşti. Temiz paket sunucusunda giriş, parola değişimi, oturum etkinliği ve yetkili erişim başarılı; oturumsuz erişim 401, tarayıcı hatası yok, 76 çıktı HTTP 200. Tam yedek şema 47 ile doğrulandı.

Testler geçici sentetik SQL.js veritabanlarında çalışır. Gerçek MSSQL, Windows ve kurum AD/proxy yük kabulü bu yerel doğrulama değildir. Güncel sır deseni kontrolünün başarısı açık S-01 bulgusunu kapatmaz.

Kanıt günlükleri `/tmp/aa-review-fixes-*`; geçici paket bilgisi `tmp/review-fixes-release.json` altındadır. Bu geçici dosyalar ve gerçek veritabanı/yedekler Git'e eklenmez.
