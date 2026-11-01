# نتیجهٔ بررسی فایل detals

این فایل بر اساس ضبط درخواست‌های موبایلت در `data/detals` بررسی شده است.
همهٔ مسیرهای جدید با پیشوند `/v1` در API و در مستند OpenAPI موجودند.
فعال‌سازی، غیرفعال‌سازی، شارژ یا برداشت جدیدی توسط عامل اجرا نشده است.

## ریال دیجیتال

| متد | مسیر محلی | قابلیت |
|---|---|---|
| GET | `/digital-rial/wallets` | لیست کیف‌ها، موجودی و وضعیت فعال‌سازی |
| POST | `/digital-rial/activation/validate` | بررسی امکان فعال‌سازی CUSTOMER |
| POST | `/digital-rial/activation/otp` | ارسال پیامک فعال‌سازی با reason برابر DIGITAL_RIAL |
| POST | `/digital-rial/wallets` | فعال‌سازی واقعی با verificationCode |
| GET | `/digital-rial/wallets/{walletId}/balance` | موجودی یک کیف |
| GET | `/digital-rial/wallets/{walletId}/transactions` | تاریخچهٔ مستقل کیف |
| GET | `/digital-rial/transactions/{id}` | جزئیات تراکنش کیف از کد عمومی بانک؛ هنوز بدون پاسخ ضبط‌شده یا تست زنده |
| POST | `/digital-rial/wallets/{walletId}/charge` | شارژ واقعی از سپرده به کیف |
| POST | `/digital-rial/wallets/{walletId}/discharge` | برداشت ریالی واقعی از کیف به سپرده |
| POST | `/digital-rial/wallets/{walletId}/deactivate` | غیرفعال‌سازی واقعی کیف |
| GET | `/digital-rial/contacts` | مخاطبان اخیر کیف |

لیست کیف‌ها در `wallets.elements` است و فیلترهای `walletTypes` و
`walletStates` را به‌صورت آرایهٔ پارامترهای تکراری می‌پذیرد؛ CSV نیز پذیرفته
می‌شود. نوع‌های مشاهده‌شده CUSTOMER و BUSINESS، و وضعیت‌های مشاهده‌شده
NORMAL و BAN هستند. فقط فعال‌سازی CUSTOMER در این ضبط ثبت شده و پشتیبانی
می‌شود؛ برای BUSINESS هیچ جریان فعال‌سازی فرض نشده است.

مراحل فعال‌سازی: validate، سپس درخواست پیامک، سپس POST کیف با
`{"walletType":"CUSTOMER","verificationCode":"123456"}`. کد نمونه ساختگی
است و باید کد خود کاربر ارسال شود. این پیامک با OTP ورود و رمز دوم کارت
متفاوت است. فعال‌سازی توسط API هنگام فراخوانی نهایی انجام می‌شود.

شارژ/برداشت به `amount` ریالی صحیح و مثبت و `depositNumber` نیاز دارد.
`requestId` اختیاری است؛ در صورت حذف یک UUID ساخته می‌شود. فیلدهای رسید
عین بانک حفظ می‌شوند. هیچ تغییر وضعیت یا جابه‌جایی پول خودکار تکرار نمی‌شود.
پس از timeout، قبل از تلاش جدید موجودی و تاریخچه را بررسی کنید؛ timeout
به معنی قطعی عدم انجام عملیات نیست.

یک تفاوت مهم اصلاح شد: در charge شمارهٔ سپرده ساده ارسال می‌شود، ولی در
discharge با RSA و پسوند کلید مشترک رمزگذاری می‌شود. مصرف‌کننده در هر دو
حالت شمارهٔ ساده را می‌فرستد و رمزگذاری بر عهدهٔ سرور است. در deactivate
نیز اگر depositNumber اختیاری ارائه شود، مطابق کد عمومی PWA رمزگذاری می‌شود.

ردیف تاریخچهٔ کیف شامل `transactionId`، `transactionType`،
`transactionTime`، `amount`، `title` و `isWithdrawal` است. شناسهٔ کیف به مسیر
جزئیات تراکنش سپرده ارسال نمی‌شود. مسیر واقعی جزئیات کیف از ماژول عمومی
`https://app.sb24.com/assets/useDigitalRial-DeMsFyrJ.js` استخراج شد و به
`/digital-rial/transactions/{id}` متصل است؛ پاسخ موفقش هنوز در ضبط نیست.

## سایر موارد جدید

| متد | مسیر محلی | قابلیت |
|---|---|---|
| GET | `/institutions` | لیست مؤسسات با length، offset و title |
| GET | `/home` | تمام آیتم‌های صفحهٔ خانهٔ بانک |
| GET | `/notifications/count` | شمارندهٔ اعلان‌ها |
| GET | `/cartable/count` | وضعیت و شمارندهٔ کارتابل |
| GET | `/onboarding/latest` | راهنمای PWA |

درخواست لیست مؤسسات در بانک POST است، ولی API محلی آن را به‌صورت GET
خواندنی ارائه می‌کند. این مسیر انتقال پول به مؤسسه را انجام نمی‌دهد.

## جزئیات تراکنش بانکی

مسیرهای موجود `/transactions/{id}` و `/transactions/detail/{id}` کل
پاسخ بانک را برمی‌گردانند. اطلاعات جدید ضبط، از جمله `categories` در صورت
وجود، `otherSideAccountInfo`، `details`، `receipt` و `newReceipt` حذف نمی‌شوند.
ردیف‌های شارژ/برداشت ریال دیجیتال که در تاریخچهٔ سپرده آمده‌اند هم از همین
مسیر جزئیات سپرده استفاده می‌کنند. جزئیات در لیست با `details=true` هم
حفظ می‌شوند. شماره پیگیری و مرجع مطابق فیلدهای واقعی بانک باقی می‌مانند.

## CLI

```powershell
node cli.js digital-rial-wallets
node cli.js digital-rial-validate
node cli.js digital-rial-otp
node cli.js digital-rial-activate
node cli.js digital-rial-balance WALLET_UUID
node cli.js digital-rial-transactions WALLET_UUID 0 10
node cli.js digital-rial-transaction TRANSACTION_ID
node cli.js digital-rial-charge WALLET_UUID DEPOSIT_NUMBER AMOUNT_IRR
node cli.js digital-rial-discharge WALLET_UUID DEPOSIT_NUMBER AMOUNT_IRR
node cli.js digital-rial-deactivate WALLET_UUID
node cli.js digital-rial-contacts
node cli.js institutions "" 0 10
node cli.js home
node cli.js notifications-count
node cli.js cartable-count
node cli.js onboarding
```

CLI برای فعال‌سازی ACTIVATE، برای غیرفعال‌سازی DEACTIVATE و برای شارژ یا
برداشت TRANSFER می‌خواهد. مسیرهای HTTP بدون پرسش تعاملی عمل می‌کنند و
مصرف‌کننده باید درخواست تغییر وضعیت یا انتقال را آگاهانه ارسال کند.

## شواهد تست

تست‌ها از شبکهٔ بانک استفاده نمی‌کنند. `research/audit-detals.js` بدنه و
پارامترهای تولیدشده را با ضبط مقایسه می‌کند و کامل‌بودن پاسخ جزئیات را
می‌سنجد؛ گزارش بدون اطلاعات حساب در `data/detals-audit.json` نوشته می‌شود.
نتیجهٔ مقایسهٔ ضبط با اجرای زندهٔ انتقال یا فعال‌سازی توسط این پیاده‌سازی
یکسان نیست. مرجع تمام درخواست‌ها و پاسخ‌های نمونه در
`API-REFERENCE.fa.md` و `openapi.json` به‌روز شده است.
در ۴۰ مورد مرتبط، قرارداد درخواست و حفظ پاسخ بررسی شد: برای فیلد RSA
برداشت، طول و قالب رمز و رمزگشایی با کلید آزمایشی بررسی می‌شود؛ برابری
بایت‌به‌بایت ciphertext تصادفی با ضبط ادعا نمی‌شود.
