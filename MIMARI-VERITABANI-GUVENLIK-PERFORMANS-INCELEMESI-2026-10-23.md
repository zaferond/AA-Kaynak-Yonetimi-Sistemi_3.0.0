# Mimari, veritabanı, güvenlik ve performans incelemesi — 23 Ekim 2026

## Kapsam ve yöntem

Kodun 23 Ekim 2026 tarihli hâli okundu: `backend/` (yaklaşık 8.600 satır), `shared/` (7.500), `frontend/src/` (37.000). Bu turdaki arayüz değişiklikleri de kapsama dahil. Önceki raporlarda ölçülmüş ve kapatılmış konular (N1–N6, M1–M6) yeniden açılmadı; yalnız bugünkü durumu değişenler yazıldı.

Kullanıcının istediği `senior-architect`, `senior-backend` ve `code-reviewer` skill'leri (claude-code-templates 1.30.0) kuruldu ve incelendi. Üçü de boş şablon. Belgelerde yalnız yer tutucu metin var ("Pattern 1", "Scenario 1"). Betikler hedefe bakmadan "0 bulgu" yazdırıyor. Bu yüzden bulgular bu araçlardan değil, kod okuması ve aşağıdaki ölçümlerden geliyor.

Ölçümler:
- `npm audit`: kök ve `frontend` ayrı ayrı.
- Demo sunucusunda (3001) yönetici hesabıyla `/api/data` süresi ve boyutu.
- Derleme çıktısının boyutu.

## Güçlü yanlar

- **İstek güvenliği** (`backend/app.mjs`): CSP, Host denetimi, değiştiren isteklerde Origin ve `X-Requested-With` denetimi, oturuma bağlı CSRF belirteci. Oturum çerezi `httpOnly` ve `sameSite=strict`. HTTPS'te HSTS etkin.
- **Hesap güvenliği**:
  - Oturum kimliği veritabanında yalnız özet olarak tutuluyor.
  - Kullanıcı sürümü değişince tüm oturumlar düşüyor.
  - AD hesaplarında her istekte aktiflik denetleniyor.
  - Giriş için IP ve hesap başına deneme sınırı var.
  - Bilinmeyen kullanıcıda da sahte şifre özeti hesaplanıyor; yanıt süresinden hesabın var olup olmadığı anlaşılamıyor.
- **Yetkilendirme varsayılan olarak reddediyor** (`backend/operations.mjs`): Her değişiklik türü için izin açıkça tanımlı. Ay kilidi yalnızca yöneticide. Her kayıtta sürüm (revision) çakışma denetimi var. Girdiler zod ile doğrulanıyor.
- **Hata yanıtları**: 500 hatalarında ayrıntı sızmıyor; kullanıcıya bir referans kodu, günlüğe neden yazılıyor.
- **SQL**: Tüm sorgular parametreli. Tablo ve sütun adları sabit bir katalogdan geliyor. Denetim kaydı aramasında LIKE özel karakterleri kaçışlanıyor.
- **Dışa aktarma**: Excel hücreleri metin olarak (`inlineStr`) yazılıyor. CSV'de `=`, `+`, `-`, `@` ile başlayan değerler kaçışlanıyor. Arayüzde `innerHTML` ya da `eval` kullanımı yok.
- **Veri katmanı**:
  - MSSQL'de uygulama kilidi var; oturum ve sayaç yazmaları iş verisi kilidinden ayrı.
  - Tam veri okumaları için bir kabul kapısı var (aynı anda 4 okuma, sıra 32).
  - Görünüm önbelleği dondurulmuş tek bir veri kopyası tutuyor; kullanıcıya özel daraltma bu kopya üzerinden yapılıyor.
- **Ölçüm**: Yönetici hesabıyla `/api/data` gzip ile 21,6 KB (sıkıştırmasız 141 KB). İlk istek 140 ms, önbellek doluyken 35–50 ms.
- **Bağımlılıklar**: Sunucu bağımlılıklarında `npm audit` 0 açık veriyor.

## Bulgular (öncelik sırasıyla)

### 1. Yüksek — Gerçek veri (3000) SQL.js ile çalışıyor

`.env` ayarları `DB_PROVIDER=sqljs` ve `NODE_ENV=development`. Kod SQL.js'i canlı ortam için yasaklıyor (`backend/store.mjs`). Ancak bu yasak yalnız `NODE_ENV=production` ile devreye giriyor. SQL.js bu kullanımda şu sınırlara sahip:

- Tüm veritabanı bellekte duruyor ve tek bir süreç kullanabiliyor.
- Her yazma veritabanını iki kez dışa aktarıyor (`export()`) ve dosyanın tamamını yeniden yazıyor. Yazma geçici dosya, `fsync` ve `rename` adımlarıyla atomik yapılıyor; klasör ayrıca `fsync` edilmiyor.
- Okumalar yazmalarla aynı sıraya giriyor.

Veritabanı 786 KB olduğu için bugün hızlı. Asıl risk dayanıklılık: Veri tek bir dosyada duruyor ve yedekleme elle yapılıyor.

**Öneri:** Canlı kullanım için MSSQL'e geçilmeli; [IT-MSSQL-GECIS.md](IT-MSSQL-GECIS.md) hazır. Geçişe kadar `npm run db:backup` ve `npm run db:verify-backup` günlük olarak zamanlanmalı.

### 2. Orta — Vite 8.0.16'da bilinen açıklar

Sürüm 8.0.16'yı kapsayan beş uyarı var (launch-editor üzerinden komut çalıştırma, `server.fs.allow` atlatma ve benzerleri). Hepsi yalnız geliştirme sunucusunu etkiliyor; derlenmiş site ve dağıtım paketi etkilenmiyor. `frontend/package.json` içinde `vite` 8.3.5'e yükseltilmeli (küçük sürüm). Ardından `npm run verify` ve tarayıcı kontrolleri çalıştırılmalı.

### 3. Orta — Yerel hesap şifre kuralı zayıf

`/api/auth/password` yalnız şu kuralları uyguluyor: en az 10 karakter, tek tırnak yok, örnek değer ya da kullanıcı adıyla aynı olmama. `1231231234` gibi sıralı bir şifre kabul ediliyor. Bu tur demo veritabanındaki `lider.sistem` ve `lider.yapisal` hesaplarına kullanıcı isteğiyle bu şifre verildi.

**Öneri:** Sıralı/tekrarlı karakter ve yaygın şifre listesi denetimi eklenmeli, en az bir harf ve bir rakam istenmeli. Demo hesapları canlı veritabanına taşınmamalı. AD hesapları bu kuraldan etkilenmiyor.

### 4. Orta — Her yazma tüm planlama verisini okuyor ve doğruluyor

Bilinen konu N3, "kısmen giderildi". `Store.mutate()` her yazmada şunları yapıyor:
- Tüm planlama verisini okuyor ve kopyalıyor.
- Verinin tamamını doğruluyor.
- Farkları yazıyor.

MSSQL'de bunların hepsi tek bir özel uygulama kilidi altında oluyor. Yazma sürdükçe başka hiçbir yazma başlamıyor ve tüm okumalar bekliyor. 9 Ekim sentetik ölçümünde tek hücre yazması 87–116 ms sürdü; bugünkü veri hacmi için yeterli. Süre veri hacmiyle doğrusal büyüyor.

**Öneri:**
- Yavaş istek günlüğü (2 sn eşiği) canlıda izlenmeli.
- Eski yıllar arşivlenmeli.
- Uzun vadede doğrulama, yalnız değişen varlıkları kapsayacak şekilde daraltılmalı.

### 5. Düşük — Arayüz tek parça paket

`app.js` 934 KB (gzip ile yaklaşık 300 KB); kod bölme ya da sonradan yükleme yok. Giriş ekranı bile uygulamanın tamamını indiriyor. İç ağda kabul edilebilir. Raporlar, Excel üretimi ve senaryo diyalogları `React.lazy` ile ayrılabilir.

### 6. Düşük — Derleme klasöründe eski çıktılar birikiyor

`site/assets` içinde 136 dosya ve 63 MB var; her derleme yeni özetli dosyalar ekliyor, eskileri silmiyor. Dağıtım paketi bunları zaten hariç tutuyor. `frontend/build.mjs`, `index.html`'in kullanmadığı özetli dosyaları silmeli.

### 7. Düşük — Bakım maliyeti

- 28 migration iki SQL lehçesi için ayrı ayrı yazılıyor (`backend/migrations/*_sqljs.sql` ve `*_mssql.sql`). Lehçeler arası eşitlik testlere bağlı.
- `frontend/src/App.tsx` 1.205 satır. Sekme durumu ve veri akışı ayrı kancalara bölünmeye devam edilmeli.

### 8. Düşük — Denetim kaydı araması tam tarama yapıyor

Arama `LOWER(...) LIKE '%…%'` ile yapılıyor ve indeks kullanamıyor. Saklama ve arşiv betikleri (`audit:retention`, `audit:archive`) var, ancak zamanlanmış değil. Tablo büyüdükçe arama yavaşlar; saklama betiği düzenli çalıştırılmalı.

## Bu turda düzeltilen

**`suggestRevisionTargets`** (`shared/project-progress.ts`): İş kilitli bir ayda %100'e ulaşmışsa öneri hiçbir aya %100 hedefi koymuyordu. Bu yüzden öneri "Hedef en geç bitiş ayında %100'e ulaşmalı" kuralına takılıyordu. Artık kilitten sonraki ilk ay %100 olarak öneriliyor. Bu durum için `tests/project-progress.test.mjs` içine kalıcı test eklendi.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| `npm test` | 992 geçti, 0 başarısız |
| `npm run format:check` | Geçti |
| Tarayıcı kontrolleri (`scripts/run-browser-checks-isolated.mjs`) | 174 grup, 300 adım geçti. Bu koşu, `suggestRevisionTargets` düzeltmesinden hemen önceki derlemede yapıldı. Düzeltme yalnız birim testleriyle doğrulandı. |
| `npm audit --omit=dev` | 0 açık |
| `npm --prefix frontend audit` | 1 yüksek (vite, yalnız geliştirme), bkz. Bulgu 2 |
