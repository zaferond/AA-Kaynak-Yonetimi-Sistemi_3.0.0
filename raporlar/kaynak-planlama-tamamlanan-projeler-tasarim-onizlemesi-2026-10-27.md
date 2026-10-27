# Kaynak planlama — tamamlanan proje görünürlüğü taslağı

**27.10.2026 · Tasarım onaylandı ve uygulandı.** Güncel davranış [uygulama raporundadır](tamamlanan-projeler-kaynak-planlama-uygulama-2026-10-27.md). Kullanıcının sonraki talebiyle ileri dönem uyarısı kaldırıldı. Bu belge ve aşağıdaki görseller, uygulama öncesindeki taslağın tarihi kaydıdır; önizleme hazırlanırken gerçek veriler ve uygulama kaynakları değiştirilmemişti.

## Önerilen görünüm

- “Tamamlanan projeleri göster” anahtarı, mevcut Gerçekleşen Dağılım Göster ve Sadece veri olanlar seçeneklerinin bulunduğu satırda, solda “Sadece veri olanlar” seçeneğinin hemen yanına eklenir.
- İlk açılışta kapalıdır. Tamamlanan proje satırları gizlenir; yanındaki küçük bilgi kutusu gizli proje sayısını gösterir.
- Açıldığında tamamlanan proje satırları geri gelir. Proje adının yanında nötr mavi/gri “Tamamlandı” etiketi bulunur.
- Görünürlük seçeneği kayıt silmez veya kaynak dağılımı değerini değiştirmez. Kapasite hesabı, bu seçenek kapalıyken de kaydedilmiş dağılımları hesaba katar. Mevcut filtrelerin hesap kapsamı korunur.
- Tamamlanan projede mevcut/ileri aylarda dağılım varsa amber bir uyarı gösterilir. Anahtar kapalıyken “Projeyi göster” işlemi ilgili kayıtları açmak için kısa yol sağlar. Projenin tamamlanmış olması tek başına gelecek dağılımları sıfırlamaz.

## Görseller

1. [Varsayılan kapalı görünüm](gorseller/2026-10-27/kaynak-planlama-tamamlanan-kapali-onizleme.png)
2. [Tamamlanan projeler açık](gorseller/2026-10-27/kaynak-planlama-tamamlanan-acik-onizleme.png)

Görseller geçici, sentetik veritabanındaki gerçek planlama ekranı üzerinde hazırlanmış DOM taslaklarıdır. Örnekte “Güç Dağıtım Ünitesi” tamamlanmıştır; Kasım 2026 için 0,4, Aralık 2026 için 0,2 kişi-ay dağılımı vardır. Kapalı/açık iki görünümde de üst özetin metni ve sayıları aynı kaldığı doğrulandı. Taslak oturumunda JavaScript hatası görülmedi.

Onaydan sonra gerçek filtre ve iki tablo yerleşimindeki tamamlandı etiketleri uygulandı. Uyarı hesabı son kullanıcı talebiyle kaldırıldı. Geçici önizleme kodu `tmp/completed-planning-preview/`, günlük `/tmp/aa-completed-planning-preview.log` altındadır; uygulama paketine dahil değildir.
