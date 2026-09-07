# Debug Session: region-admin-409
- **Status**: [OPEN]
- **Issue**: Anaokulu okul girişi başarılı; ancak platform panelinden bölge yöneticisi oluşturma isteği 409 Conflict ile başarısız oluyor.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-region-admin-409.ndjson

## Reproduction Steps
1. Platform panelinde `Anaokulu Üyeleri` sayfasını aç.
2. `Bölge Yöneticisi Oluştur` modalını aç.
3. Yeni e-posta ve geçerli anaokulu seçimi ile formu gönder.
4. Beklenen: başarılı oluşturma. Mevcut: 409 Conflict ve "Bu e-posta ile zaten bir üyelik var."

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Aynı e-posta için veritabanında mevcut bir kullanıcı zaten var | High | Low | Pending |
| B | Backend duplicate sorgusu gereğinden geniş ve yanlış pozitif veriyor | High | Low | Pending |
| C | Frontend aynı POST isteğini iki kez gönderiyor; ilki başarılı, ikincisi 409 | Medium | Medium | Pending |
| D | Çalışan backend süreci dosyadaki son kodla aynı değil | Medium | Low | Pending |
| E | Unique index `email + regionSystemType/systemType` kombinasyonunda beklenmedik çakışma üretiyor | Medium | Medium | Pending |

## Log Evidence
- Instrumentation added to frontend submit, backend route entry, duplicate lookup, create error, and create success points.
- Fresh log reset completed before reproduction.
- Browser evidence: request was blocked before reaching backend due to CORS preflight rejection on custom `x-debug-trace` header.

## Verification Conclusion
- Temporary instrumentation issue confirmed and corrected by removing custom request header from the frontend POST call.
- Backend duplicate root cause is still pending fresh reproduction evidence.
