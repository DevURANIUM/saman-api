# مرجع کامل درخواست و پاسخ API موبایلت سامان

نسخهٔ API: 0.3.0 — تاریخ مستند: ۱۴۰۵/۰۸/۱۰ (2026-11-01).

## قرارداد عمومی

آدرس پایه: `http://127.0.0.1:8089/v1`. تمام مسیرهای زیر نسبت به این آدرس‌اند. هدر `x-api-key` همان SAMAN_API_KEY است. برای POSTهای دارای بدنه، `Content-Type: application/json` بفرستید. فقط health بدون کلید است. مسیرهای قدیمی بدون /v1 هم فعال‌اند.

هر سرور یک نشست بانکی دارد. مصرف‌کننده کلید API محلی را ارسال می‌کند؛ توکن بانک و کلیدهای رمزگذاری در سرور باقی می‌مانند. رمز ورود و رمزهای تراکنش ذخیره نمی‌شوند. مبلغ‌ها ریال‌اند. شماره حساب، کارت، شبا، شناسه و مرجع را رشته نگه دارید.

نمونه‌های پاسخ از ساختار ضبط‌های بانک ساخته شده‌اند ولی **تمام مقادیر شخصی و عددی با دادهٔ ساختگی جایگزین شده‌اند**. آرایهٔ نمونه یک عضو دارد؛ تعداد واقعی اعضا تابع حساب و صفحه‌بندی است. برای فیلدهای اختیاری، نبودن فیلد به معنی ندادن آن توسط بانک است. هیچ فیلد بانکی از نام افراد یا متن شرح حدس زده نمی‌شود.

## راه‌اندازی و جریان کامل ورود

`npm start` را در پوشهٔ saman-api اجرا کنید. SAMAN_API_KEY، SAMAN_HOST و SAMAN_PORT را در محیط فرایند تنظیم کنید. برای اتصال یک سرویس به راهنمای API.md رجوع کنید. نیازی به اجرای CLI نیست.

۱. POST /auth/login با username و password.
۲. پیامک دستگاه در صورت نیاز خودکار درخواست می‌شود؛ اگر otpRequired=true و otpSent=true بود کد را از کاربر بگیرید. برای جریان قدیمی requestOtp:false را در login بفرستید.
۳. POST /auth/otp با code.
۴. bankVerified=true نشان می‌دهد همان درخواست با بانک بررسی شده است.
۵. با GET /deposits سپردهٔ درست را انتخاب و depositNumber آن را برای تراکنش بفرستید.
۶. در 401 نشست بانکی، دوباره وارد شوید. shouldChangePassword نیازمند تکمیل تغییر رمز در برنامهٔ بانک است.

## قرارداد خطا

| HTTP | معنی |
|---|---|
|400|پارامتر یا بدنه نامعتبر، نبودن انتخاب سپرده در حساب چندسپرده‌ای|
|401|کلید API نامعتبر یا نشست بانکی مفقود/منقضی؛ error علت را مشخص می‌کند|
|403|نیاز به تأیید دستگاه|
|404|مسیر محلی موجود نیست|
|413|بدنه بیش از 32KB|
|422|بانک درخواست را با کد منطقی رد کرده است|
|500|خطای داخلی محلی|
|502|قطع ارتباط یا پاسخ بانک با ساختار نامعتبر|

```json
{
  "error": "شرح خطای بانک",
  "code": -500,
  "bankStatus": {
    "code": -500,
    "name": "FAILURE",
    "message": "شرح خطای بانک"
  }
}
```

code و bankStatus فقط در صورت وجود برمی‌گردند. کد منطقی صفر بانک موفق است؛ HTTP 200 بانک با code غیرصفر موفق محسوب نمی‌شود. برای ارسال پول، timeout لزوماً به معنی عدم انتقال نیست؛ پیش از اقدام جدید تاریخچه را بررسی کنید.

## 1. GET /health

سلامت فرایند محلی؛ به بانک وصل نمی‌شود و کلید API لازم ندارد.

**نمونهٔ درخواست:**

```http
GET /v1/health HTTP/1.1
Host: 127.0.0.1:8089
```

**نمونهٔ پاسخ 200:**

```json
{
  "ok": true
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 2. GET /capabilities

فهرست کامل دستورهای CLI و متد/مسیر معادل آن‌ها در API. این درخواست به بانک وصل نمی‌شود. مسیرها شامل پیشوند /v1 هستند و همه به‌جز health به کلید API نیاز دارند.

**نمونهٔ درخواست:**

```http
GET /v1/capabilities HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "basePath": "/v1",
  "operations": [
    {
      "command": "login",
      "method": "POST",
      "path": "/v1/auth/login"
    },
    {
      "command": "otp-request",
      "method": "POST",
      "path": "/v1/auth/otp/request"
    },
    {
      "command": "otp",
      "method": "POST",
      "path": "/v1/auth/otp"
    },
    {
      "command": "status",
      "method": "GET",
      "path": "/v1/auth/session"
    },
    {
      "command": "check-session",
      "method": "POST",
      "path": "/v1/auth/session/check"
    },
    {
      "command": "logout",
      "method": "POST",
      "path": "/v1/auth/logout"
    },
    {
      "command": "ensure-session",
      "method": "POST",
      "path": "/v1/auth/session/ensure"
    },
    {
      "command": "config",
      "method": "POST",
      "path": "/v1/config"
    },
    {
      "command": "import-har",
      "method": "POST",
      "path": "/v1/auth/import-har"
    },
    {
      "command": "profile",
      "method": "GET",
      "path": "/v1/profile"
    },
    {
      "command": "accounts",
      "method": "GET",
      "path": "/v1/accounts"
    },
    {
      "command": "deposits",
      "method": "GET",
      "path": "/v1/deposits"
    },
    {
      "command": "accounts-with-cards",
      "method": "GET",
      "path": "/v1/accounts/with-cards"
    },
    {
      "command": "cards",
      "method": "GET",
      "path": "/v1/cards"
    },
    {
      "command": "cards-all",
      "method": "GET",
      "path": "/v1/cards/all"
    },
    {
      "command": "deposits-all",
      "method": "GET",
      "path": "/v1/deposits/all"
    },
    {
      "command": "balance",
      "method": "GET",
      "path": "/v1/balance"
    },
    {
      "command": "balance-deposits",
      "method": "GET",
      "path": "/v1/balances/deposits"
    },
    {
      "command": "balance-cards",
      "method": "GET",
      "path": "/v1/balances/cards"
    },
    {
      "command": "digital-rial-wallets",
      "method": "GET",
      "path": "/v1/digital-rial/wallets"
    },
    {
      "command": "digital-rial-validate",
      "method": "POST",
      "path": "/v1/digital-rial/activation/validate"
    },
    {
      "command": "digital-rial-otp",
      "method": "POST",
      "path": "/v1/digital-rial/activation/otp"
    },
    {
      "command": "digital-rial-activate",
      "method": "POST",
      "path": "/v1/digital-rial/wallets"
    },
    {
      "command": "digital-rial-balance",
      "method": "GET",
      "path": "/v1/digital-rial/wallets/{walletId}/balance"
    },
    {
      "command": "digital-rial-transactions",
      "method": "GET",
      "path": "/v1/digital-rial/wallets/{walletId}/transactions"
    },
    {
      "command": "digital-rial-transaction",
      "method": "GET",
      "path": "/v1/digital-rial/transactions/{id}"
    },
    {
      "command": "digital-rial-deactivate",
      "method": "POST",
      "path": "/v1/digital-rial/wallets/{walletId}/deactivate"
    },
    {
      "command": "digital-rial-charge",
      "method": "POST",
      "path": "/v1/digital-rial/wallets/{walletId}/charge"
    },
    {
      "command": "digital-rial-discharge",
      "method": "POST",
      "path": "/v1/digital-rial/wallets/{walletId}/discharge"
    },
    {
      "command": "digital-rial-contacts",
      "method": "GET",
      "path": "/v1/digital-rial/contacts"
    },
    {
      "command": "institutions",
      "method": "GET",
      "path": "/v1/institutions"
    },
    {
      "command": "home",
      "method": "GET",
      "path": "/v1/home"
    },
    {
      "command": "notifications-count",
      "method": "GET",
      "path": "/v1/notifications/count"
    },
    {
      "command": "cartable-count",
      "method": "GET",
      "path": "/v1/cartable/count"
    },
    {
      "command": "onboarding",
      "method": "GET",
      "path": "/v1/onboarding/latest"
    },
    {
      "command": "transactions",
      "method": "GET",
      "path": "/v1/transactions"
    },
    {
      "command": "transactions-latest",
      "method": "GET",
      "path": "/v1/transactions/latest"
    },
    {
      "command": "transaction",
      "method": "GET",
      "path": "/v1/transactions/{id}"
    },
    {
      "command": "transaction-find",
      "method": "GET",
      "path": "/v1/transactions/find/{code}"
    },
    {
      "command": "transaction-categories",
      "method": "GET",
      "path": "/v1/transactions/categories"
    },
    {
      "command": "transaction-types",
      "method": "GET",
      "path": "/v1/transactions/types"
    },
    {
      "command": "iban",
      "method": "GET",
      "path": "/v1/accounts/{number}/iban"
    },
    {
      "command": "owner",
      "method": "GET",
      "path": "/v1/owner/iban/{iban}"
    },
    {
      "command": "transfers-latest",
      "method": "GET",
      "path": "/v1/transfers/latest"
    },
    {
      "command": "deposits-favorites",
      "method": "GET",
      "path": "/v1/deposits/favorites"
    },
    {
      "command": "deposits-categories",
      "method": "GET",
      "path": "/v1/deposits/categories"
    },
    {
      "command": "samanium",
      "method": "GET",
      "path": "/v1/samanium"
    },
    {
      "command": "merchant-terminals",
      "method": "GET",
      "path": "/v1/merchant/terminals"
    },
    {
      "command": "merchant-summary",
      "method": "GET",
      "path": "/v1/merchant/summary"
    },
    {
      "command": "card-owner",
      "method": "POST",
      "path": "/v1/transfers/card/owner"
    },
    {
      "command": "transfer-otp",
      "method": "POST",
      "path": "/v1/transfers/card/otp"
    },
    {
      "command": "transfer-card",
      "method": "POST",
      "path": "/v1/transfers/card"
    },
    {
      "command": "deposit-owner",
      "method": "GET",
      "path": "/v1/owner/deposit/{number}"
    },
    {
      "command": "transfer-reasons",
      "method": "GET",
      "path": "/v1/transfers/reasons"
    },
    {
      "command": "transfer-recent",
      "method": "GET",
      "path": "/v1/transfers/recent/{kind}"
    },
    {
      "command": "recent-deposit",
      "method": "GET",
      "path": "/v1/deposits/recent"
    },
    {
      "command": "recent-card",
      "method": "GET",
      "path": "/v1/cards/recent"
    },
    {
      "command": "recent-iban",
      "method": "GET",
      "path": "/v1/ibans/recent"
    },
    {
      "command": "transfer-deposit",
      "method": "POST",
      "path": "/v1/transfers/deposit"
    },
    {
      "command": "transfer-iban",
      "method": "POST",
      "path": "/v1/transfers/iban"
    },
    {
      "command": "help",
      "method": "GET",
      "path": "/v1/openapi.json"
    }
  ]
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 3. GET /auth/session

وضعیت محلی نشست؛ expiresAt میلی‌ثانیه و expiresIn ثانیه است. state یکی از logged_out، expired، otp_required، password_change_required، authenticated یا unverified است.

**نمونهٔ درخواست:**

```http
GET /v1/auth/session HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "loggedIn": true,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "authenticated",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": true,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": false,
  "nextAction": null
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 4. POST /auth/session/check

با user/ بانک تماس می‌گیرد. bankVerified فقط پس از موفقیت همان درخواست true می‌شود.

**نمونهٔ درخواست:**

```http
POST /v1/auth/session/check HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "loggedIn": true,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "authenticated",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": true,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": false,
  "nextAction": null,
  "bankVerified": true
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 5. POST /auth/session/ensure

نشست را با بانک بررسی می‌کند؛ فقط اگر نشست موجود نباشد، منقضی شده باشد یا بانک 401 بدهد، با username/password بدنه یا SAMAN_USER/SAMAN_PASS فرایند، یک بار ورود مجدد STATIC انجام می‌دهد. رمز در فایل نشست ذخیره نمی‌شود. نشست معتبر renewed:false و bankVerified:true می‌دهد؛ ورود مجدد کامل renewed:true می‌دهد. بدون مشخصات ورود nextAction:login و credentialsRequired:true است. در نیاز به تأیید دستگاه، پیامک خودکار درخواست و nextAction:verify_otp برگردانده می‌شود. اگر ارسال موفق نباشد nextAction:otp_request و otpError را بررسی کنید. نشست پیامک نیمه‌تمام دوباره login نمی‌شود و پیامک موفق تکرار نمی‌شود. در صورت ورود جدیدِ در انتظار پیامک reloginPerformed:true و renewed:false است. خطای شبکه یا رمز اشتباه باعث حلقهٔ ورود یا تکرار انتقال نمی‌شود. هیچ دستور انتقالی توسط این مسیر دوباره اجرا نمی‌شود.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|username|string|خیر||
|password|string|خیر|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |

**نمونهٔ درخواست:**

```http
POST /v1/auth/session/ensure HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "loggedIn": true,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "authenticated",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": true,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": false,
  "nextAction": null,
  "bankVerified": true,
  "renewed": false
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 6. POST /auth/login

نام کاربری و رمز را بدهید؛ پیامک دستگاه در صورت نیاز خودکار درخواست می‌شود و otpRequired، otpSent و nextAction مرحلهٔ بعد را مشخص می‌کنند. با requestOtp:false می‌توان جریان قدیمی ارسال جداگانهٔ پیامک را حفظ کرد. پاسخ نمونه حالت نیاز به ورود کدِ پیامکِ ارسال‌شده است. اگر دستگاه معتبر باشد، پاسخ موفق شامل bankVerified:true خواهد بود. توکن بانک به مصرف‌کننده برگردانده نمی‌شود.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|username|string|بله||
|password|string|بله|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|loginType|string|خیر| مقادیر: STATIC، OTP1|
|requestOtp|boolean|خیر|false preserves the legacy separate SMS-request step|

**نمونهٔ درخواست:**

```http
POST /v1/auth/login HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "username": "example-user",
  "password": "ExamplePassword123"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "loggedIn": false,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "otp_required",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": false,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": true,
  "nextAction": "verify_otp",
  "deviceVerificationRequired": true,
  "bankVerified": false,
  "otpSent": true
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

**ورود بدون نیاز به پیامک:**

```json
{
  "loggedIn": true,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "authenticated",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": true,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": false,
  "nextAction": null,
  "bankVerified": true
}
```

## 7. POST /auth/otp/request

کد تأیید دستگاه را پیامک می‌کند؛ این مسیر با رمز دوم کارت‌به‌کارت متفاوت است. expiration مدت اعتبار به ثانیه است.

**نمونهٔ درخواست:**

```http
POST /v1/auth/otp/request HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "name": "OK",
    "message": ""
  },
  "expiration": 120,
  "logLevel": "NONE"
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 8. POST /auth/otp

کد را تأیید و سپس نشست را با بانک بررسی می‌کند. ارقام فارسی و انگلیسی پذیرفته می‌شوند. موبایل و توکن در خروجی این مسیر نمایش داده نمی‌شود.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|code|string|بله|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |

**نمونهٔ درخواست:**

```http
POST /v1/auth/otp HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "code": "123456"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "loggedIn": true,
  "hasToken": true,
  "deviceUid": "00000000-0000-4000-8000-000000000001",
  "state": "authenticated",
  "expiresAt": 1793500600000,
  "expiresIn": 600,
  "trustedDevice": true,
  "shouldChangePassword": false,
  "ok": true,
  "otpRequired": false,
  "nextAction": null,
  "bankVerified": true
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 9. POST /auth/logout

فقط نشست محلی را پاک می‌کند و شناسهٔ دستگاه را نگه می‌دارد؛ لغو نشست در سرور بانک نیست.

**نمونهٔ درخواست:**

```http
POST /v1/auth/logout HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "ok": true,
  "scope": "local"
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 10. POST /auth/import-har

همان قابلیت import-har در CLI؛ خود محتوای JSON فایل HAR را در بدنهٔ درخواست بفرستید، نه مسیر فایل روی سرور. حداکثر بدنه 20MB است و هدر x-api-key پیش از خواندن بدنه بررسی می‌شود. فقط توکن، شناسه دستگاه، نسخه، متادیتای دستگاه و کوکی‌های درخواست معتبر موبایلت استخراج می‌شوند؛ فایل کامل، رمز ورود و درخواست‌های ضبط‌شده ذخیره یا اجرا نمی‌شوند. موفقیت import به معنی معتبر بودن فعلی توکن نیست؛ POST /auth/session/check را جداگانه اجرا کنید.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|log|object|بله||

**نمونهٔ درخواست:**

```http
POST /v1/auth/import-har HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "log": {
    "entries": [
      {
        "request": {
          "method": "GET",
          "url": "https://mobillet.sb24.com/account/deposits",
          "headers": [
            {
              "name": "authorization",
              "value": "Bearer EXAMPLE_TOKEN"
            },
            {
              "name": "deviceUid",
              "value": "00000000-0000-4000-8000-000000000001"
            }
          ],
          "cookies": []
        },
        "response": {
          "status": 200,
          "content": {
            "mimeType": "application/json",
            "text": "{\"status\":{\"code\":0},\"deposits\":[]}"
          }
        }
      }
    ]
  }
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "imported": true,
  "authenticatedRequestsObserved": 1,
  "cookieCount": 0,
  "liveVerified": false
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 11. GET /profile

User profile

**نمونهٔ درخواست:**

```http
GET /v1/profile HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 12. GET /deposits

Deposit list only

**نمونهٔ درخواست:**

```http
GET /v1/deposits HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 13. GET /accounts

Alias for deposit list

**نمونهٔ درخواست:**

```http
GET /v1/accounts HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 14. GET /accounts/with-cards

Deposits with cards

**نمونهٔ درخواست:**

```http
GET /v1/accounts/with-cards HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": true,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 15. GET /accounts/categories

Categorized deposits

**نمونهٔ درخواست:**

```http
GET /v1/accounts/categories HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "categorizeDeposits": [
    {
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "deposits": [
        {
          "balance": 1000000,
          "bank": {
            "id": 1,
            "name": "نمونه",
            "logoUrl": "https://example.invalid/asset.png",
            "identifier": "نمونه",
            "ibanId": "IR220000000000000000000001",
            "largeLogoUrl": "https://example.invalid/asset.png",
            "requiredOtp": false
          },
          "bankGroupType": "PASANDAZ",
          "blockAmount": 1000000,
          "createdDate": 1793500000000,
          "currency": "ریال",
          "currencyObject": {
            "code": "نمونه",
            "localizedDescription": "شرح نمونه",
            "symbol": "نمونه"
          },
          "depositStatus": "OPEN",
          "depositType": {
            "code": "000001",
            "couldBeInterestDestination": true,
            "interestRate": 1,
            "minimumOpeningAmount": 1000000,
            "title": "نمونه"
          },
          "favorite": true,
          "fullName": "",
          "hasChequeBook": false,
          "iban": "IR220000000000000000000001",
          "id": 1,
          "isPrivate": true,
          "label": "نمونه",
          "minimumOtpAmount": {},
          "number": "123-456-0000001-2",
          "order": 1,
          "otpTicketAmount": 1000000,
          "owner": "کاربر نمونه",
          "paymentable": true,
          "personality": "ACTUAL",
          "private": true,
          "rawNumber": "123-456-0000001-2",
          "signature": "نمونه",
          "title": "نمونه",
          "topupable": true,
          "transferable": true,
          "withdrawOption": "BE_TANHAYEE"
        }
      ]
    }
  ],
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 16. GET /deposits/categories

Alias for categorized deposits

**نمونهٔ درخواست:**

```http
GET /v1/deposits/categories HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "categorizeDeposits": [
    {
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "deposits": [
        {
          "balance": 1000000,
          "bank": {
            "id": 1,
            "name": "نمونه",
            "logoUrl": "https://example.invalid/asset.png",
            "identifier": "نمونه",
            "ibanId": "IR220000000000000000000001",
            "largeLogoUrl": "https://example.invalid/asset.png",
            "requiredOtp": false
          },
          "bankGroupType": "PASANDAZ",
          "blockAmount": 1000000,
          "createdDate": 1793500000000,
          "currency": "ریال",
          "currencyObject": {
            "code": "نمونه",
            "localizedDescription": "شرح نمونه",
            "symbol": "نمونه"
          },
          "depositStatus": "OPEN",
          "depositType": {
            "code": "000001",
            "couldBeInterestDestination": true,
            "interestRate": 1,
            "minimumOpeningAmount": 1000000,
            "title": "نمونه"
          },
          "favorite": true,
          "fullName": "",
          "hasChequeBook": false,
          "iban": "IR220000000000000000000001",
          "id": 1,
          "isPrivate": true,
          "label": "نمونه",
          "minimumOtpAmount": {},
          "number": "123-456-0000001-2",
          "order": 1,
          "otpTicketAmount": 1000000,
          "owner": "کاربر نمونه",
          "paymentable": true,
          "personality": "ACTUAL",
          "private": true,
          "rawNumber": "123-456-0000001-2",
          "signature": "نمونه",
          "title": "نمونه",
          "topupable": true,
          "transferable": true,
          "withdrawOption": "BE_TANHAYEE"
        }
      ]
    }
  ],
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 17. GET /cards

Card list only

**نمونهٔ درخواست:**

```http
GET /v1/cards HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "cards": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "cardStatus": "OK",
      "cardStatusCause": "نمونه",
      "cardType": "DEBIT",
      "currency": "ریال",
      "debitOrderId": 1,
      "deposit": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "inaugurationDate": 1793500000000,
        "isCommercial": false,
        "isFavorite": true,
        "label": "نمونه",
        "minimumOtpAmount": {
          "OWN": 1,
          "SATNA": 1,
          "DEPOSIT": 1,
          "PAYA": 1,
          "POL": 1
        },
        "number": "123-456-0000001-2",
        "order": 1,
        "paymentable": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "نمونه",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "title": "نمونه",
        "topupable": true,
        "transferable": true
      },
      "eBankingConnected": true,
      "expireDate": "140801",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "hasCvv2": false,
      "id": 1,
      "isCardOtpActivated": true,
      "isNeedRegisterShaparak": false,
      "isPrivate": true,
      "issueDate": 1793500000000,
      "lastname": "نمونه",
      "needsRevival": false,
      "order": 1,
      "pan": "1111222233334444",
      "paymentable": true,
      "private": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "securePan": "1111222233334444",
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 18. GET /cards/all

تمام رکوردها و تمام فیلدهای کارت‌هایی که بانک برای نشست جاری برمی‌گرداند؛ نام جایگزین /cards. فیلتر منتخب یا صفحه‌بندی محلی اعمال نمی‌شود.

**نمونهٔ درخواست:**

```http
GET /v1/cards/all HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "cards": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "cardStatus": "OK",
      "cardStatusCause": "نمونه",
      "cardType": "DEBIT",
      "currency": "ریال",
      "debitOrderId": 1,
      "deposit": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "inaugurationDate": 1793500000000,
        "isCommercial": false,
        "isFavorite": true,
        "label": "نمونه",
        "minimumOtpAmount": {
          "OWN": 1,
          "SATNA": 1,
          "DEPOSIT": 1,
          "PAYA": 1,
          "POL": 1
        },
        "number": "123-456-0000001-2",
        "order": 1,
        "paymentable": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "نمونه",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "title": "نمونه",
        "topupable": true,
        "transferable": true
      },
      "eBankingConnected": true,
      "expireDate": "140801",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "hasCvv2": false,
      "id": 1,
      "isCardOtpActivated": true,
      "isNeedRegisterShaparak": false,
      "isPrivate": true,
      "issueDate": 1793500000000,
      "lastname": "نمونه",
      "needsRevival": false,
      "order": 1,
      "pan": "1111222233334444",
      "paymentable": true,
      "private": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "securePan": "1111222233334444",
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 19. GET /deposits/all

تمام رکوردها و تمام فیلدهای سپرده‌هایی که بانک برای نشست جاری برمی‌گرداند؛ نام جایگزین /deposits و /accounts. فیلتر منتخب اعمال نمی‌شود.

**نمونهٔ درخواست:**

```http
GET /v1/deposits/all HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 20. GET /balance

موجودی‌های گزارش‌شده در لیست سپرده‌ها و کارت‌ها را در دو آرایهٔ مجزا برمی‌گرداند. balance و currency عین بانک حفظ می‌شوند؛ balanceAvailable مشخص می‌کند عدد موجودی در پاسخ موجود بوده است. نبودن عدد موجودی، null و false می‌دهد، نه صفر. موجودی کارت ممکن است همان سپردهٔ متصل باشد؛ جمع کل بین دو آرایه محاسبه نمی‌شود. این مسیر استعلام جداگانهٔ موجودی کارت بانک دیگر انجام نمی‌دهد.

**نمونهٔ درخواست:**

```http
GET /v1/balance HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ],
  "cards": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "cardStatus": "OK",
      "cardStatusCause": "نمونه",
      "cardType": "DEBIT",
      "currency": "ریال",
      "debitOrderId": 1,
      "deposit": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "inaugurationDate": 1793500000000,
        "isCommercial": false,
        "isFavorite": true,
        "label": "نمونه",
        "minimumOtpAmount": {
          "OWN": 1,
          "SATNA": 1,
          "DEPOSIT": 1,
          "PAYA": 1,
          "POL": 1
        },
        "number": "123-456-0000001-2",
        "order": 1,
        "paymentable": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "نمونه",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "title": "نمونه",
        "topupable": true,
        "transferable": true
      },
      "eBankingConnected": true,
      "expireDate": "140801",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "hasCvv2": false,
      "id": 1,
      "isCardOtpActivated": true,
      "isNeedRegisterShaparak": false,
      "isPrivate": true,
      "issueDate": 1793500000000,
      "lastname": "نمونه",
      "needsRevival": false,
      "order": 1,
      "pan": "1111222233334444",
      "paymentable": true,
      "private": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "securePan": "1111222233334444",
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ]
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 21. GET /balances

نام جایگزین /balance با همان دو آرایهٔ deposits و cards؛ موجودی گزارش‌شده در فهرست بانک، بدون جمع تکراری.

**نمونهٔ درخواست:**

```http
GET /v1/balances HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ],
  "cards": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "cardStatus": "OK",
      "cardStatusCause": "نمونه",
      "cardType": "DEBIT",
      "currency": "ریال",
      "debitOrderId": 1,
      "deposit": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "inaugurationDate": 1793500000000,
        "isCommercial": false,
        "isFavorite": true,
        "label": "نمونه",
        "minimumOtpAmount": {
          "OWN": 1,
          "SATNA": 1,
          "DEPOSIT": 1,
          "PAYA": 1,
          "POL": 1
        },
        "number": "123-456-0000001-2",
        "order": 1,
        "paymentable": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "نمونه",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "title": "نمونه",
        "topupable": true,
        "transferable": true
      },
      "eBankingConnected": true,
      "expireDate": "140801",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "hasCvv2": false,
      "id": 1,
      "isCardOtpActivated": true,
      "isNeedRegisterShaparak": false,
      "isPrivate": true,
      "issueDate": 1793500000000,
      "lastname": "نمونه",
      "needsRevival": false,
      "order": 1,
      "pan": "1111222233334444",
      "paymentable": true,
      "private": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "securePan": "1111222233334444",
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ]
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 22. GET /balances/deposits

فقط موجودی سپرده‌ها: id، depositNumber، iban، title، currency، balance و balanceAvailable. تمام فیلدهای اصلی سپرده نیز بدون حذف حفظ می‌شوند.

**نمونهٔ درخواست:**

```http
GET /v1/balances/deposits HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 23. GET /balances/cards

فقط موجودی گزارش‌شده کارت‌ها: id، pan، securePan، depositNumber، fullName، currency، cardStatus، balance و balanceAvailable. نبود موجودی به معنی صفر نیست؛ تمام فیلدهای اصلی کارت نیز بدون حذف حفظ می‌شوند.

**نمونهٔ درخواست:**

```http
GET /v1/balances/cards HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "cards": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "cardStatus": "OK",
      "cardStatusCause": "نمونه",
      "cardType": "DEBIT",
      "currency": "ریال",
      "debitOrderId": 1,
      "deposit": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "inaugurationDate": 1793500000000,
        "isCommercial": false,
        "isFavorite": true,
        "label": "نمونه",
        "minimumOtpAmount": {
          "OWN": 1,
          "SATNA": 1,
          "DEPOSIT": 1,
          "PAYA": 1,
          "POL": 1
        },
        "number": "123-456-0000001-2",
        "order": 1,
        "paymentable": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "نمونه",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "title": "نمونه",
        "topupable": true,
        "transferable": true
      },
      "eBankingConnected": true,
      "expireDate": "140801",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "hasCvv2": false,
      "id": 1,
      "isCardOtpActivated": true,
      "isNeedRegisterShaparak": false,
      "isPrivate": true,
      "issueDate": 1793500000000,
      "lastname": "نمونه",
      "needsRevival": false,
      "order": 1,
      "pan": "1111222233334444",
      "paymentable": true,
      "private": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "securePan": "1111222233334444",
      "transferable": true,
      "depositNumber": "123-456-0000001-2",
      "balanceAvailable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 24. GET /deposits/favorites

فیلتر محلی همان لیست سپرده‌هاست؛ اگر isFavorite موجود باشد ملاک است، در نبودش favorite بررسی می‌شود. هیچ سپرده‌ای منتخب یا حذف نمی‌شود.

**نمونهٔ درخواست:**

```http
GET /v1/deposits/favorites HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "deposits": [
    {
      "balance": 1000000,
      "bank": {
        "id": 1,
        "name": "نمونه",
        "logoUrl": "https://example.invalid/asset.png",
        "identifier": "نمونه",
        "ibanId": "IR220000000000000000000001",
        "largeLogoUrl": "https://example.invalid/asset.png",
        "requiredOtp": false
      },
      "card": {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "identifier": "نمونه",
          "ibanId": "IR220000000000000000000001",
          "largeLogoUrl": "https://example.invalid/asset.png",
          "requiredOtp": false
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "cardType": "DEBIT",
        "currency": "ریال",
        "debitOrderId": 1,
        "eBankingConnected": true,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "hasCvv2": false,
        "id": 1,
        "isCardOtpActivated": false,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "private": true,
        "restriction": {
          "min": 1000000,
          "max": 1000000,
          "dailyRemaining": 1000000,
          "monthlyRemaining": 1000000,
          "message": "",
          "minOtpTicketAmount": 1000000,
          "ownOtpTicketAmount": 1000000
        },
        "securePan": "1111222233334444",
        "transferable": true
      },
      "createdDate": 1793500000000,
      "currency": "ریال",
      "currencyObject": {
        "code": "نمونه",
        "localizedDescription": "شرح نمونه",
        "symbol": "نمونه"
      },
      "depositStatus": "OPEN",
      "depositType": {
        "code": "000001",
        "couldBeInterestDestination": true,
        "interestRate": 1,
        "minimumOpeningAmount": 1000000,
        "title": "نمونه"
      },
      "favorite": true,
      "hasChequeBook": false,
      "iban": "IR220000000000000000000001",
      "id": 1,
      "inaugurationDate": 1793500000000,
      "isCommercial": false,
      "isFavorite": true,
      "label": "نمونه",
      "minimumOtpAmount": {
        "OWN": 1,
        "SATNA": 1,
        "DEPOSIT": 1,
        "PAYA": 1,
        "POL": 1
      },
      "number": "123-456-0000001-2",
      "order": 1,
      "paymentable": true,
      "restriction": {
        "min": 1000000,
        "max": 1000000,
        "dailyRemaining": 1000000,
        "monthlyRemaining": 1000000,
        "message": "نمونه",
        "minOtpTicketAmount": 1000000,
        "ownOtpTicketAmount": 1000000
      },
      "title": "نمونه",
      "topupable": true,
      "transferable": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 25. GET /samanium

Samanium score and level

**نمونهٔ درخواست:**

```http
GET /v1/samanium HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "score": 1,
  "maximumScore": 1000000,
  "minimumScore": 1000000,
  "loyaltyScore": 1,
  "level": "TWO",
  "loyaltyLevels": [
    {
      "level": "ONE",
      "minScore": 1000000
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 26. GET /merchant/terminals

Merchant terminals

**نمونهٔ درخواست:**

```http
GET /v1/merchant/terminals HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "terminals": [
    {
      "name": "نمونه",
      "id": "example-transaction-id",
      "depositNumber": "123-456-0000001-2",
      "registrationDate": 1793500000000,
      "type": "INTERNET",
      "typeName": "نمونه"
    }
  ]
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 27. GET /transactions/categories

Transaction categories

**نمونهٔ درخواست:**

```http
GET /v1/transactions/categories HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "categories": [
    {
      "id": 1,
      "name": "نمونه",
      "groupEnName": "EXPENDITURE",
      "isWithdrawal": true
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 28. GET /transactions/types

Transaction types

**نمونهٔ درخواست:**

```http
GET /v1/transactions/types HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 29. GET /transfers/latest

Latest transfer source

**نمونهٔ درخواست:**

```http
GET /v1/transfers/latest HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "transfer": {
    "type": "CARD",
    "id": 1
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 30. GET /transfers/reasons

کد و شرح بابت‌های پایا. یکی از codeهای همین پاسخ را در reasonCode ارسال کنید؛ GPAC فقط نمونه است و باید در پاسخ بانک شما موجود باشد.

**نمونهٔ درخواست:**

```http
GET /v1/transfers/reasons HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "reasons": [
    {
      "code": "GPAC",
      "description": "شرح نمونه"
    }
  ],
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 31. GET /opening-account/terms

Opening-account terms

**نمونهٔ درخواست:**

```http
GET /v1/opening-account/terms HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 32. GET /opening-account/customer

Opening-account state

**نمونهٔ درخواست:**

```http
GET /v1/opening-account/customer HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 33. GET /home

تمام محتوای پاسخ app/home بانک در items برگردانده می‌شود؛ هیچ آیتم نمایشی یا دادهٔ بانکی حذف نمی‌شود.

**نمونهٔ درخواست:**

```http
GET /v1/home HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "items": [
    {
      "properties": {
        "size": {
          "width": 1,
          "height": 1
        }
      },
      "type": "SPACE"
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 34. GET /notifications/count

شمارندهٔ اعلان‌ها با notifications شامل count و type؛ فقط خواندنی.

**نمونهٔ درخواست:**

```http
GET /v1/notifications/count HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "notifications": [
    {
      "count": 1,
      "type": "CARTABLE_AWAITING_SIGNATURE"
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 35. GET /cartable/count

تعداد و وضعیت کارتابل شامل hasCartable، badgeCount و hasMore؛ فقط خواندنی.

**نمونهٔ درخواست:**

```http
GET /v1/cartable/count HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "hasCartable": false,
  "badgeCount": 1,
  "hasMore": false,
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 36. GET /onboarding/latest

آخرین راهنمای PWA با platform:PWA از بانک؛ اگر بانک محتوایی نداشته باشد ممکن است فقط status و logLevel بازگرداند.

**نمونهٔ درخواست:**

```http
GET /v1/onboarding/latest HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 37. GET /institutions

فهرست مؤسسات از درخواست خواندنی POST institution/list بانک؛ API محلی GET است. length پیش‌فرض ۱۰، offset پیش‌فرض صفر و title پیش‌فرض رشته خالی. پاسخ شامل institutions و totalRecord است؛ انتقال به مؤسسه توسط این مسیر انجام نمی‌شود.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|length|query|integer|خیر| پیش‌فرض: 10|
|offset|query|integer|خیر| پیش‌فرض: 0|
|title|query|string|خیر| پیش‌فرض: |

**نمونهٔ درخواست:**

```http
GET /v1/institutions HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "institutions": [
    {
      "currency": "IRR",
      "id": "example-transaction-id",
      "title": "نمونه"
    }
  ],
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "totalRecord": 1
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 38. GET /digital-rial/wallets

GET فهرست کیف‌ها و فلگ‌های hasCustomerWallet، hasBusinessWallet و inactiveWalletCount را برمی‌گرداند؛ POST فعال‌سازی واقعی کیف CUSTOMER با verificationCode است. فیلترهای walletTypes و walletStates را می‌توان تکراری یا با کاما ارسال کرد. مقدارهای مشاهده‌شده CUSTOMER/BUSINESS و NORMAL/BAN هستند؛ فهرست تو در تو در wallets.elements است. هیچ کیف BUSINESS توسط این نسخه فعال نمی‌شود. جزئیات هر کیف شامل walletId، walletAddress، walletType، walletState، balance و rapsaDeepLink بانک بدون تبدیل برمی‌گردد.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|page|query|integer|خیر| پیش‌فرض: 0|
|size|query|integer|خیر| پیش‌فرض: 10|
|walletStates|query|array|خیر| پیش‌فرض: NORMAL,BAN|
|walletTypes|query|array|خیر| پیش‌فرض: BUSINESS,CUSTOMER|

**نمونهٔ درخواست:**

```http
GET /v1/digital-rial/wallets?page=0&size=10 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "wallets": {
    "numberOfElements": 1,
    "hasNext": false,
    "hasPrevious": true,
    "elements": [
      {
        "walletId": "00000000-0000-4000-8000-000000000001",
        "walletAddress": "00000000000001",
        "walletType": "CUSTOMER",
        "walletState": "NORMAL",
        "balance": 1000000,
        "rapsaDeepLink": "https://example.invalid/asset.png"
      }
    ]
  },
  "inactiveWalletCount": 1,
  "hasBusinessWallet": false,
  "hasCustomerWallet": true,
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 39. POST /digital-rial/wallets

GET فهرست کیف‌ها و فلگ‌های hasCustomerWallet، hasBusinessWallet و inactiveWalletCount را برمی‌گرداند؛ POST فعال‌سازی واقعی کیف CUSTOMER با verificationCode است. فیلترهای walletTypes و walletStates را می‌توان تکراری یا با کاما ارسال کرد. مقدارهای مشاهده‌شده CUSTOMER/BUSINESS و NORMAL/BAN هستند؛ فهرست تو در تو در wallets.elements است. هیچ کیف BUSINESS توسط این نسخه فعال نمی‌شود. جزئیات هر کیف شامل walletId، walletAddress، walletType، walletState، balance و rapsaDeepLink بانک بدون تبدیل برمی‌گردد.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|verificationCode|string|بله|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|walletType|string|خیر| مقادیر: CUSTOMER|

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/wallets HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "verificationCode": "123456"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "wallet": {
    "walletId": "00000000-0000-4000-8000-000000000001",
    "walletAddress": "00000000000001",
    "walletType": "CUSTOMER",
    "walletState": "NORMAL",
    "balance": 1000000,
    "rapsaDeepLink": "https://example.invalid/asset.png"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 40. POST /digital-rial/activation/validate

بررسی امکان فعال‌سازی CUSTOMER است و خودش کیف ایجاد نمی‌کند. walletType پیش‌فرض CUSTOMER است. پاسخ و خطای بانک عیناً حفظ می‌شوند.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|walletType|string|خیر| مقادیر: CUSTOMER|

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/activation/validate HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 41. POST /digital-rial/activation/otp

پیامک مخصوص ریال دیجیتال با reason:DIGITAL_RIAL؛ با پیامک ورود و رمز دوم کارت متفاوت است. خودش کیف ایجاد نمی‌کند. پس از دریافت کد باید POST /digital-rial/wallets اجرا شود.

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/activation/otp HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "expiration": 1793500000000,
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 42. GET /digital-rial/wallets/{walletId}/balance

موجودی مستقیم یک کیف مشخص از پاسخ بانک. واحد یا مبلغ توسط برنامه تغییر نمی‌کند. walletId باید UUID واقعیِ برگشتی از لیست کیف‌ها باشد.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|walletId|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/digital-rial/wallets/00000000-0000-4000-8000-000000000001/balance HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "balance": 1000000,
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 43. GET /digital-rial/wallets/{walletId}/transactions

تاریخچهٔ مستقل کیف با page از صفر و size پیش‌فرض ۱۰، حداکثر ۱۰۰. ردیف‌های ضبط‌شده شامل transactionId، transactionType، transactionTime، amount، title و isWithdrawal هستند. این شناسه با id تراکنش سپرده یکسان نیست؛ برای جزئیات کیف از /digital-rial/transactions/{id} استفاده کنید.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|walletId|path|string|بله||
|page|query|integer|خیر| پیش‌فرض: 0|
|size|query|integer|خیر| پیش‌فرض: 10|

**نمونهٔ درخواست:**

```http
GET /v1/digital-rial/wallets/00000000-0000-4000-8000-000000000001/transactions?page=0&size=10 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "elements": [
    {
      "transactionId": 1,
      "transactionType": "CHARGE",
      "transactionTime": "نمونه",
      "amount": 1000000,
      "title": "نمونه",
      "isWithdrawal": false
    }
  ],
  "hasNext": false,
  "hasPrevious": true,
  "logLevel": "INFO",
  "numberOfElements": 1,
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 44. GET /digital-rial/transactions/{id}

مسیر واقعی digital-rial/wallet/transaction-detail/{id} از ماژول عمومی useDigitalRial-DeMsFyrJ.js بانک استخراج شده است. id همان transactionId عددی تاریخچهٔ کیف است. این مسیر در HAR نمونهٔ پاسخ ندارد و هنوز زنده تست نشده؛ پاسخ موفق یا schema ساختگی ارائه نمی‌شود و در صورت موفقیت تمام JSON بانک حفظ می‌شود.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|id|path|string|بله|transactionId from wallet history, not a deposit-history id|

**نمونهٔ درخواست:**

```http
GET /v1/digital-rial/transactions/example-transaction-id HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 45. POST /digital-rial/wallets/{walletId}/deactivate

غیرفعال‌سازی واقعی کیف. درخواست POST بانک با walletId و requestId است؛ در نبود requestId یک UUID ساخته می‌شود. depositNumber اختیاری در صورت ارائه مطابق کد عمومی بانک رمزگذاری می‌شود. ارسال یک‌بار است؛ این عملیات هنگام توسعه اجرا نشده است.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|walletId|path|string|بله||

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|requestId|string|خیر||
|depositNumber|string|خیر|Optional destination deposit; encrypted like the PWA if supplied|

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/wallets/00000000-0000-4000-8000-000000000001/deactivate HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 46. POST /digital-rial/wallets/{walletId}/charge

جابه‌جایی واقعی پول از depositNumber به کیف؛ مبلغ ریال، صحیح و مثبت است. پاسخ کامل receipt حفظ می‌شود. requestId اختیاری و پیش‌فرض UUID جدید است. هیچ تکرار خودکاری وجود ندارد؛ در timeout پیش از تکرار موجودی/تاریخچه را بررسی کنید.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|walletId|path|string|بله||

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|amount|integer|بله|IRR|
|depositNumber|string|بله||
|requestId|string|خیر||

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/wallets/00000000-0000-4000-8000-000000000001/charge HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "amount": 100000,
  "depositNumber": "123-456-0000001-2"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "receipt": {
    "amount": 1000000,
    "bankUrl": "https://example.invalid/asset.png",
    "currency": "ریال",
    "details": [
      {
        "type": "KEY_VALUE",
        "key": "نمونه",
        "value": "نمونه"
      }
    ],
    "footerImageUrl": "https://example.invalid/asset.png",
    "header": "نمونه",
    "shareText": "شرح نمونه",
    "subtitle": "000001",
    "title": "نمونه",
    "trackingCode": "000000000001"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 47. POST /digital-rial/wallets/{walletId}/discharge

برداشت ریالی واقعی از کیف به depositNumber با amount مثبت و requestId اختیاری؛ شماره سپرده را ساده بفرستید، سرور آن را با RSA و پسوند کلید مشترک رمزگذاری می‌کند. این تفاوت با charge در HAR و کد عمومی بانک تأیید شده است. پاسخ کامل رسید حفظ می‌شود. ارسال فقط یک‌بار است و این عملیات در تست زندهٔ عامل اجرا نشده است.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|walletId|path|string|بله||

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|amount|integer|بله|IRR|
|depositNumber|string|بله||
|requestId|string|خیر||

**نمونهٔ درخواست:**

```http
POST /v1/digital-rial/wallets/00000000-0000-4000-8000-000000000001/discharge HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "amount": 100000,
  "depositNumber": "123-456-0000001-2"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "receipt": {
    "amount": 1000000,
    "bankUrl": "https://example.invalid/asset.png",
    "currency": "ریال",
    "details": [
      {
        "type": "KEY_VALUE",
        "key": "نمونه",
        "value": "نمونه"
      }
    ],
    "footerImageUrl": "https://example.invalid/asset.png",
    "header": "نمونه",
    "shareText": "شرح نمونه",
    "subtitle": "نمونه",
    "title": "نمونه",
    "trackingCode": "000000000001"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 48. GET /digital-rial/contacts

مخاطبان اخیر کیف از most-referreds با type:WALLET و size پیش‌فرض ۱۲۰. پاسخ کامل elements و صفحه‌بندی حفظ می‌شود. این مسیر مخاطب ایجاد نمی‌کند.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|size|query|integer|خیر| پیش‌فرض: 120|

**نمونهٔ درخواست:**

```http
GET /v1/digital-rial/contacts?size=120 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "elements": [],
  "hasNext": false,
  "hasPrevious": false,
  "logLevel": "INFO",
  "numberOfElements": 1,
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 49. GET /transactions

خروجی لیست تراکنش فقط elements است؛ سپرده‌ها یا کارت‌ها در آن بازگردانده نمی‌شوند. برای حساب چندسپرده‌ای، depositNumber الزامی است و فقدانش 400 است. alias برابر account نیز پذیرفته می‌شود. details پیش‌فرض true است و جزئیات کامل هر ردیف را به detail اضافه می‌کند. صفحه از صفر شروع می‌شود و تاریخ فیلتر به ثانیه است. پارامتر ناشناخته 400 می‌گیرد.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|depositNumber|query|string|خیر|Required if more than one deposit exists. Preserve hyphens.|
|page|query|integer|خیر| پیش‌فرض: 0|
|size|query|integer|خیر| پیش‌فرض: 10|
|details|query|boolean|خیر| پیش‌فرض: true|
|fromDate|query|integer|خیر|Unix seconds|
|toDate|query|integer|خیر|Unix seconds|
|fromAmount|query|string|خیر||
|toAmount|query|string|خیر||
|query|query|string|خیر||
|isWithdrawal|query|boolean|خیر||

**نمونهٔ درخواست:**

```http
GET /v1/transactions?depositNumber=123-456-0000001-2&page=0&size=10 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "elements": [
    {
      "id": "example-transaction-id",
      "title": "نمونه",
      "amount": 1000000,
      "currency": "ریال",
      "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
      "longDate": 1793500000000,
      "isWithdrawal": false,
      "description": "شرح نمونه",
      "branch": "نمونه",
      "detail": {
        "title": "نمونه",
        "description": "شرح نمونه",
        "amount": 1000000,
        "currency": "ریال",
        "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
        "longDate": 1793500000000,
        "isWithdrawal": false,
        "depositNumber": "123-456-0000001-2",
        "referralNumber": "000000000001",
        "paymentNumber": "000000000001",
        "category": {
          "id": 1,
          "groupEnName": "UNKNOWN_INCOMING",
          "name": "نمونه"
        },
        "otherSideAccountInfo": {
          "name": "نمونه",
          "type": "DEPOSIT_TRANSFER"
        },
        "details": [
          {
            "logoUrl": "https://example.invalid/asset.png",
            "title": "نمونه",
            "value": "نمونه"
          }
        ],
        "transactionType": "DEPOSIT_TRANSFER",
        "logLevel": "INFO",
        "status": {
          "code": 0,
          "message": "",
          "name": "OK"
        },
        "withdrawal": false
      }
    }
  ],
  "hasNext": true,
  "hasPrevious": true,
  "logLevel": "INFO",
  "numberOfElements": 1,
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 50. GET /transactions/latest

آخرین تراکنش‌های یک سپرده: همیشه صفحهٔ صفر تاریخچهٔ بانک، با limit پیش‌فرض ۱۰ و حداکثر ۱۰۰. ترتیب جدید به قدیم در ضبط بانک تأیید شده و ترتیب پاسخ بانک حفظ می‌شود. depositNumber با سپرده‌های خود کاربر تطبیق داده می‌شود؛ در حساب چندسپرده‌ای الزامی است. size نام جایگزین limit است؛ اگر هر دو باشند باید برابر باشند. فقط depositNumber، account، limit، size و details پذیرفته می‌شوند؛ برای فیلتر تاریخ یا صفحه‌بندی از /transactions استفاده کنید. خروجی تمام فیلدهای تاریخچه به‌علاوه depositNumber، page:0 و limit است. details=true اطلاعات کامل هر ردیف را نیز می‌گیرد. با /transfers/latest متفاوت است: آن مسیر اطلاعات مبدأ آخرین انتقال را نشان می‌دهد، نه تراکنش‌ها.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|depositNumber|query|string|خیر|Required with multiple deposits; verified against deposit list|
|limit|query|integer|خیر| پیش‌فرض: 10|
|size|query|integer|خیر|Alias for limit; both must match if supplied together|
|details|query|boolean|خیر| پیش‌فرض: true|

**نمونهٔ درخواست:**

```http
GET /v1/transactions/latest?depositNumber=123-456-0000001-2&size=example HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "elements": [
    {
      "id": "example-transaction-id",
      "title": "نمونه",
      "amount": 1000000,
      "currency": "ریال",
      "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
      "longDate": 1793500000000,
      "isWithdrawal": false,
      "description": "شرح نمونه",
      "branch": "نمونه",
      "detail": {
        "title": "نمونه",
        "description": "شرح نمونه",
        "amount": 1000000,
        "currency": "ریال",
        "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
        "longDate": 1793500000000,
        "isWithdrawal": false,
        "depositNumber": "123-456-0000001-2",
        "referralNumber": "000000000001",
        "paymentNumber": "000000000001",
        "category": {
          "id": 1,
          "groupEnName": "UNKNOWN_INCOMING",
          "name": "نمونه"
        },
        "otherSideAccountInfo": {
          "name": "نمونه",
          "type": "DEPOSIT_TRANSFER"
        },
        "details": [
          {
            "logoUrl": "https://example.invalid/asset.png",
            "title": "نمونه",
            "value": "نمونه"
          }
        ],
        "transactionType": "DEPOSIT_TRANSFER",
        "logLevel": "INFO",
        "status": {
          "code": 0,
          "message": "",
          "name": "OK"
        },
        "withdrawal": false
      }
    }
  ],
  "hasNext": true,
  "hasPrevious": true,
  "logLevel": "INFO",
  "numberOfElements": 1,
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "depositNumber": "123-456-0000001-2",
  "page": 0,
  "limit": 10
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 51. GET /transactions/{id}

شناسهٔ ردیف را بدون تغییر و با URL encoding ارسال کنید. otherSideAccountInfo طرف مقابل است: در واریز، فرستنده و در برداشت، گیرنده. نام و کارت فرستنده از متن حدس زده نمی‌شود. تمام اطلاعات موجود شامل مرجع، پیگیری، رسید و جزئیات بازگردانده می‌شود.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|id|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/transactions/example-transaction-id HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "title": "نمونه",
  "description": "شرح نمونه",
  "amount": 1000000,
  "currency": "ریال",
  "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
  "longDate": 1793500000000,
  "isWithdrawal": false,
  "depositNumber": "123-456-0000001-2",
  "referralNumber": "000000000001",
  "paymentNumber": "000000000001",
  "category": {
    "id": 1,
    "groupEnName": "UNKNOWN_INCOMING",
    "name": "نمونه"
  },
  "otherSideAccountInfo": {
    "name": "نمونه",
    "type": "DEPOSIT_TRANSFER"
  },
  "details": [
    {
      "logoUrl": "https://example.invalid/asset.png",
      "title": "نمونه",
      "value": "نمونه"
    }
  ],
  "transactionType": "DEPOSIT_TRANSFER",
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "withdrawal": false
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 52. GET /transactions/detail/{id}

نام جایگزین مسیر جزئیات تراکنش؛ قرارداد پاسخ یکسان است.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|id|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/transactions/detail/example-transaction-id HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "title": "نمونه",
  "description": "شرح نمونه",
  "amount": 1000000,
  "currency": "ریال",
  "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
  "longDate": 1793500000000,
  "isWithdrawal": false,
  "depositNumber": "123-456-0000001-2",
  "referralNumber": "000000000001",
  "paymentNumber": "000000000001",
  "category": {
    "id": 1,
    "groupEnName": "UNKNOWN_INCOMING",
    "name": "نمونه"
  },
  "otherSideAccountInfo": {
    "name": "نمونه",
    "type": "DEPOSIT_TRANSFER"
  },
  "details": [
    {
      "logoUrl": "https://example.invalid/asset.png",
      "title": "نمونه",
      "value": "نمونه"
    }
  ],
  "transactionType": "DEPOSIT_TRANSFER",
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "withdrawal": false
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 53. GET /transactions/find/{code}

جست‌وجوی محلی صفحه‌به‌صفحه در تاریخچهٔ سپرده، با دریافت جزئیات هر تراکنش؛ مسیر مستقیم جست‌وجوی پیگیری در بانک تأیید نشده است. تطبیق دقیق است و ارقام فارسی/عربی پذیرفته می‌شوند؛ صفرهای ابتدایی حذف نمی‌شوند. any کد پیگیری و شماره مرجع را بررسی می‌کند؛ tracking فقط trackingCode، newReceipt.trackingCode، paymentNumber و فوتر رسید با عنوان شماره پیگیری، و reference فقط referralNumber را مقایسه می‌کند. اولین تطبیق با matchedField و کل پاسخ جزئیات در transaction بازمی‌گردد. اگر found=false و searchComplete=false باشد، محدودهٔ جست‌وجو تمام شده است و نمی‌توان نبود تراکنش را نتیجه گرفت. stopReason شامل matched، end_of_history، page_limit، transaction_limit یا repeated_page است. searchComplete=true در حالت نبودن فقط پایان تاریخچهٔ محدودشده با فیلترهای درخواست را تأیید می‌کند. پیش‌فرض ۱۰ صفحه و ۲۰۰ جزئیات است؛ درخواست‌ها ترتیبی‌اند و ممکن است طول بکشد. خطای بانک یا نشست به خطای HTTP تبدیل می‌شود، نه پاسخ found=false.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|code|path|string|بله||
|depositNumber|query|string|خیر|Required with multiple deposits|
|pages|query|integer|خیر| پیش‌فرض: 10|
|maxTransactions|query|integer|خیر| پیش‌فرض: 200|
|page|query|integer|خیر| پیش‌فرض: 0|
|size|query|integer|خیر| پیش‌فرض: 20|
|matchBy|query|string|خیر| پیش‌فرض: any مقادیر: any، tracking، reference|
|fromDate|query|integer|خیر|Unix seconds|
|toDate|query|integer|خیر|Unix seconds|
|isWithdrawal|query|boolean|خیر||
|fromAmount|query|string|خیر||
|toAmount|query|string|خیر||
|query|query|string|خیر||

**نمونهٔ درخواست:**

```http
GET /v1/transactions/find/000000000001?depositNumber=123-456-0000001-2&page=0&size=20 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "found": true,
  "trackingNumber": "000000000001",
  "depositNumber": "123-456-0000001-2",
  "matchBy": "any",
  "pagesScanned": 1,
  "transactionsScanned": 1,
  "matchedField": "newReceipt.trackingCode",
  "id": "example-transaction-id",
  "transaction": {
    "title": "نمونه",
    "description": "شرح نمونه",
    "amount": 1000000,
    "currency": "ریال",
    "persianDate": "۱۴۰۵/۰۸/۱۰ ۱۲:۰۰:۰۰",
    "longDate": 1793500000000,
    "isWithdrawal": false,
    "depositNumber": "123-456-0000001-2",
    "referralNumber": "000000000001",
    "paymentNumber": "000000000001",
    "category": {
      "id": 1,
      "groupEnName": "UNKNOWN_INCOMING",
      "name": "نمونه"
    },
    "otherSideAccountInfo": {
      "name": "نمونه",
      "type": "DEPOSIT_TRANSFER"
    },
    "details": [
      {
        "logoUrl": "https://example.invalid/asset.png",
        "title": "نمونه",
        "value": "نمونه"
      }
    ],
    "transactionType": "DEPOSIT_TRANSFER",
    "logLevel": "INFO",
    "status": {
      "code": 0,
      "message": "",
      "name": "OK"
    },
    "withdrawal": false
  },
  "searchComplete": true,
  "stopReason": "matched"
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## 54. GET /owner/deposit/{number}

Account/IBAN lookup

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|number|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/owner/deposit/123-456-0000001-2 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "bank": {
    "id": 1,
    "name": "نمونه",
    "logoUrl": "https://example.invalid/asset.png",
    "largeLogoUrl": "https://example.invalid/asset.png"
  },
  "isSelfDeposit": true,
  "isSelfIBAN": false,
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "transferMessages": {},
  "user": {
    "firstname": "نام",
    "fullName": "کاربر نمونه",
    "imageUrl": "https://example.invalid/asset.png",
    "isMostReferred": true
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 55. GET /owner/iban/{iban}

Account/IBAN lookup

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|iban|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/owner/iban/IR220000000000000000000001 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "bank": {
    "id": 1,
    "name": "نمونه",
    "logoUrl": "https://example.invalid/asset.png",
    "largeLogoUrl": "https://example.invalid/asset.png"
  },
  "iban": "IR220000000000000000000001",
  "isSelfDeposit": false,
  "isSelfIBAN": true,
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "transferMessages": {
    "SATNA": "نمونه",
    "PAYA": "نمونه"
  },
  "user": {
    "fullName": "کاربر نمونه",
    "isMostReferred": true
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 56. GET /accounts/{number}/iban

Account/IBAN lookup

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|number|path|string|بله||

**نمونهٔ درخواست:**

```http
GET /v1/accounts/123-456-0000001-2/iban HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**پاسخ موفق:** این مسیر پاسخ JSON بانک را بدون تبدیل بازمی‌گرداند. در فایل‌های فعلی نمونهٔ موفقی برای این مسیر ثبت نشده است؛ بنابراین نام فیلدها و نمونهٔ موفق ساختگی ارائه نمی‌شود. قرارداد تضمین‌شدهٔ خطا همان بخش خطاهاست و schema موفق در OpenAPI یک object باز است.

## 57. GET /merchant/summary

terminalId و fromDate به هدرهای بانک تبدیل می‌شوند. fromDate میلی‌ثانیه است؛ در صورت حذف، ۳۰ روز قبل از اکنون انتخاب می‌شود.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|terminalId|query|string|بله||
|fromDate|query|integer|خیر|Unix milliseconds|

**نمونهٔ درخواست:**

```http
GET /v1/merchant/summary?terminalId=12345678 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "summaries": {
    "PENDING": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    },
    "UNSETTLED": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    },
    "CONFLICT": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    },
    "UN_SUCCESS": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    },
    "SETTLED": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    },
    "PROCESSING": {
      "count": 1,
      "amount": 1000000,
      "currency": "ریال"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 58. GET /transfers/recent/{kind}

kind یکی از card، deposit یا iban است. amount ریالی به هدر بانک تبدیل می‌شود. پاسخ‌های هر سه حالت جداگانه در ادامه آمده‌اند.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|kind|path|string|بله| مقادیر: card، deposit، iban|
|amount|query|integer|بله||

**نمونهٔ درخواست:**

```http
GET /v1/transfers/recent/deposit?amount=100000 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200 برای kind=card:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredCards": [
    {
      "card": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "debitOrderId": 1,
        "isNeedRegisterShaparak": false,
        "mostreferredId": 1,
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "securePan": "1111222233334444"
      },
      "user": {
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "isMostReferred": true,
        "lastname": ""
      }
    }
  ],
  "restrictions": {
    "CARD": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [
      {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "currency": "ریال",
        "debitOrderId": 1,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "id": 1,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "securePan": "1111222233334444",
        "transferable": true
      }
    ],
    "deposits": [],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

**نمونهٔ پاسخ 200 برای kind=deposit:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredDeposits": [
    {
      "deposit": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "fullName": "",
        "minimumOtpAmount": {},
        "mostreferredId": 1,
        "number": "123-456-0000001-2",
        "order": 1,
        "otpTicketAmount": 1000000
      },
      "user": {
        "fullName": "کاربر نمونه",
        "imageUrl": "https://example.invalid/asset.png",
        "isMostReferred": true,
        "mobileNumber": "09000000000"
      }
    }
  ],
  "restrictions": {
    "DEPOSIT": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [],
    "deposits": [
      {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "bankGroupType": "PASANDAZ",
        "blockAmount": 1000000,
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "fullName": "",
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "isPrivate": true,
        "label": "نمونه",
        "minimumOtpAmount": {},
        "number": "123-456-0000001-2",
        "order": 1,
        "otpTicketAmount": 1000000,
        "owner": "کاربر نمونه",
        "paymentable": true,
        "personality": "ACTUAL",
        "private": true,
        "rawNumber": "123-456-0000001-2",
        "signature": "نمونه",
        "title": "نمونه",
        "topupable": true,
        "transferable": true,
        "withdrawOption": "BE_TANHAYEE"
      }
    ],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

**نمونهٔ پاسخ 200 برای kind=iban:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredIbans": [
    {
      "iban": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "iban": "IR220000000000000000000001",
        "logLevel": "INFO",
        "mostreferredId": 1,
        "order": 1,
        "status": {
          "code": 0,
          "message": "",
          "name": "OK"
        }
      },
      "user": {
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "lastname": "نمونه"
      }
    }
  ],
  "restrictionMessages": {
    "SATNA": "نمونه"
  },
  "restrictions": {
    "IBAN": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    },
    "SATNA": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    },
    "PAYA": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [],
    "deposits": [],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 59. GET /deposits/recent

مقصدهای اخیر/پرکاربرد انتقال به سپرده، نه لیست سپرده‌های خود کاربر و نه آخرین تراکنش‌ها. amount ریالی اجباری است و به هدر بانک تبدیل می‌شود. پاسخ کامل mostReferredDeposits، restrictions، isOverLimit و userSelfContact برمی‌گردد. شماره‌ها، اطلاعات صاحب مقصد و بانک بدون تبدیل یا حذف حفظ می‌شوند. نام جایگزین /transfers/recent/deposit است.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|amount|query|integer|بله|Transfer amount in IRR; used for bank restrictions|

**نمونهٔ درخواست:**

```http
GET /v1/deposits/recent?amount=100000 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredDeposits": [
    {
      "deposit": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "fullName": "",
        "minimumOtpAmount": {},
        "mostreferredId": 1,
        "number": "123-456-0000001-2",
        "order": 1,
        "otpTicketAmount": 1000000
      },
      "user": {
        "fullName": "کاربر نمونه",
        "imageUrl": "https://example.invalid/asset.png",
        "isMostReferred": true,
        "mobileNumber": "09000000000"
      }
    }
  ],
  "restrictions": {
    "DEPOSIT": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [],
    "deposits": [
      {
        "balance": 1000000,
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "bankGroupType": "PASANDAZ",
        "blockAmount": 1000000,
        "createdDate": 1793500000000,
        "currency": "ریال",
        "currencyObject": {
          "code": "نمونه",
          "localizedDescription": "شرح نمونه",
          "symbol": "نمونه"
        },
        "depositStatus": "OPEN",
        "depositType": {
          "code": "000001",
          "couldBeInterestDestination": true,
          "interestRate": 1,
          "minimumOpeningAmount": 1000000,
          "title": "نمونه"
        },
        "favorite": true,
        "fullName": "",
        "hasChequeBook": false,
        "iban": "IR220000000000000000000001",
        "id": 1,
        "isPrivate": true,
        "label": "نمونه",
        "minimumOtpAmount": {},
        "number": "123-456-0000001-2",
        "order": 1,
        "otpTicketAmount": 1000000,
        "owner": "کاربر نمونه",
        "paymentable": true,
        "personality": "ACTUAL",
        "private": true,
        "rawNumber": "123-456-0000001-2",
        "signature": "نمونه",
        "title": "نمونه",
        "topupable": true,
        "transferable": true,
        "withdrawOption": "BE_TANHAYEE"
      }
    ],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 60. GET /cards/recent

نام جایگزین /transfers/recent/card برای مقصدهای اخیر کارت‌به‌کارت. amount ریالی الزامی است؛ mostReferredCards، restrictions و userSelfContact عیناً برمی‌گردند. این لیست با /cards/all که رکوردهای کارت نشست است متفاوت است.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|amount|query|integer|بله|Transfer amount in IRR; used for bank restrictions|

**نمونهٔ درخواست:**

```http
GET /v1/cards/recent?amount=100000 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredCards": [
    {
      "card": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "debitOrderId": 1,
        "isNeedRegisterShaparak": false,
        "mostreferredId": 1,
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "securePan": "1111222233334444"
      },
      "user": {
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "isMostReferred": true,
        "lastname": ""
      }
    }
  ],
  "restrictions": {
    "CARD": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [
      {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "cardStatus": "OK",
        "cardStatusCause": "نمونه",
        "currency": "ریال",
        "debitOrderId": 1,
        "expireDate": "140801",
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "id": 1,
        "isNeedRegisterShaparak": false,
        "isPrivate": true,
        "issueDate": 1793500000000,
        "lastname": "نمونه",
        "needsRevival": false,
        "order": 1,
        "pan": "1111222233334444",
        "paymentable": true,
        "securePan": "1111222233334444",
        "transferable": true
      }
    ],
    "deposits": [],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 61. GET /ibans/recent

نام جایگزین /transfers/recent/iban برای شباهای مقصد اخیر. amount ریالی الزامی است؛ mostReferredIbans، restrictionMessages، restrictions و userSelfContact حفظ می‌شوند. وجود محدودیت SATNA در پاسخ به معنی پیاده‌سازی ارسال ساتنا در این برنامه نیست.

| پارامتر | محل | نوع | الزامی | توضیح |
|---|---|---|---|---|
|amount|query|integer|بله|Transfer amount in IRR; used for bank restrictions|

**نمونهٔ درخواست:**

```http
GET /v1/ibans/recent?amount=100000 HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

**نمونهٔ پاسخ 200:**

```json
{
  "isOverLimit": false,
  "logLevel": "INFO",
  "mostReferredIbans": [
    {
      "iban": {
        "bank": {
          "id": 1,
          "name": "نمونه",
          "logoUrl": "https://example.invalid/asset.png",
          "largeLogoUrl": "https://example.invalid/asset.png"
        },
        "iban": "IR220000000000000000000001",
        "logLevel": "INFO",
        "mostreferredId": 1,
        "order": 1,
        "status": {
          "code": 0,
          "message": "",
          "name": "OK"
        }
      },
      "user": {
        "firstname": "نام",
        "fullName": "کاربر نمونه",
        "lastname": "نمونه"
      }
    }
  ],
  "restrictionMessages": {
    "SATNA": "نمونه"
  },
  "restrictions": {
    "IBAN": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    },
    "SATNA": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    },
    "PAYA": {
      "min": 1000000,
      "max": 1000000,
      "dailyRemaining": 1000000,
      "monthlyRemaining": 1000000,
      "message": "نمونه",
      "minOtpTicketAmount": 1000000,
      "ownOtpTicketAmount": 1000000
    }
  },
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "userSelfContact": {
    "cards": [],
    "deposits": [],
    "ibans": [],
    "user": {
      "cif": "000001",
      "firstname": "نام",
      "fullName": "کاربر نمونه",
      "id": 1,
      "imageUrl": "https://example.invalid/asset.png",
      "lastname": "نمونه",
      "mobileNumber": "09000000000"
    }
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 62. POST /transfers/card/owner

POST است اما انتقال وجه انجام نمی‌دهد؛ نام و بانک مقصد کارت را استعلام می‌کند.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|source|string|بله||
|destination|string|بله||

**نمونهٔ درخواست:**

```http
POST /v1/transfers/card/owner HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "source": "1111222233334444",
  "destination": "5555666677778888"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "user": {
    "firstname": "نام",
    "fullName": "کاربر نمونه",
    "isMostReferred": true,
    "lastname": "نمونه"
  },
  "bank": {
    "id": 1,
    "name": "نمونه",
    "logoUrl": "https://example.invalid/asset.png",
    "largeLogoUrl": "https://example.invalid/asset.png"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 63. POST /transfers/card/otp

درخواست پیامک رمز دوم برای کارت، مقصد و مبلغ مشخص. پاسخ کامل بانک شامل expirationTime برگردانده می‌شود؛ واحد expirationTime در قرارداد فعلی تبدیل نشده است.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|source|string|بله||
|destination|string|بله||
|amount|integer|بله|IRR|
|description|string|خیر||
|trackerId|string|خیر||
|transactionPin|string|خیر|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|isMostReferredDestination|boolean|خیر||

**نمونهٔ درخواست:**

```http
POST /v1/transfers/card/otp HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "source": "1111222233334444",
  "destination": "5555666677778888",
  "amount": 100000
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "expirationTime": 1793500000000,
  "logLevel": "INFO"
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 64. POST /transfers/card

اجرای واقعی کارت‌به‌کارت. CVV2، pin2 و transactionPin اختیاری رمزگذاری می‌شوند. مبلغ ریال و انقضا سال/ماه شمسی YYYYMM است. هیچ retry خودکاری انجام نمی‌شود.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|source|string|بله||
|destination|string|بله||
|amount|integer|بله|IRR|
|description|string|خیر||
|trackerId|string|خیر||
|transactionPin|string|خیر|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|isMostReferredDestination|boolean|خیر||
|cvv2|string|بله|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|pin2|string|بله|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|expireDate|string|بله|Jalali YYYYMM|

**نمونهٔ درخواست:**

```http
POST /v1/transfers/card HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "source": "1111222233334444",
  "destination": "5555666677778888",
  "amount": 100000,
  "cvv2": "123",
  "pin2": "123456",
  "expireDate": "140801"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "receipt": {
    "title": "نمونه",
    "footerImage": "https://example.invalid/asset.png",
    "contents": [
      {
        "title": "نمونه",
        "value": "نمونه"
      }
    ],
    "footer": [
      {
        "title": "نمونه",
        "value": "000001"
      }
    ],
    "shareText": "شرح نمونه"
  },
  "newReceipt": {
    "amount": 1000000,
    "bankUrl": "https://example.invalid/asset.png",
    "currency": "ریال",
    "details": [
      {
        "type": "KEY_VALUE",
        "key": "نمونه",
        "value": "نمونه"
      }
    ],
    "footerImageUrl": "https://example.invalid/asset.png",
    "header": "نمونه",
    "shareText": "شرح نمونه",
    "subtitle": "نمونه",
    "title": "نمونه",
    "trackingCode": "000000000001"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "transferDetail": {
    "sourceAccount": {
      "number": "1111222233334444",
      "transferType": "CARD",
      "type": "CARD"
    },
    "destinationAccount": {
      "number": "1111222233334444",
      "transferType": "CARD",
      "type": "CARD"
    },
    "destinationUser": {
      "fullName": ""
    },
    "currency": "IRR",
    "amount": 1000000,
    "id": 1,
    "paidDate": 1793500000000,
    "trackingCode": "000000000001"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 65. POST /transfers/deposit

انتقال واقعی حساب‌به‌حساب با DEPOSIT. شماره‌ها رشته‌اند و خط تیره و صفرهای ابتدایی حفظ می‌شوند. CVV2 یا رمز کارت به این درخواست اضافه نمی‌شود.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|source|string|بله||
|destination|string|بله||
|amount|integer|بله|IRR|
|description|string|خیر||
|trackerId|string|خیر||
|transactionPin|string|خیر|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|isMostReferredDestination|boolean|خیر||

**نمونهٔ درخواست:**

```http
POST /v1/transfers/deposit HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "source": "123-456-0000001-2",
  "destination": "123-456-0000002-3",
  "amount": 100000
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "receipt": {
    "title": "نمونه",
    "footerImage": "https://example.invalid/asset.png",
    "contents": [
      {
        "title": "نمونه",
        "value": "نمونه"
      }
    ],
    "footer": [
      {
        "title": "نمونه",
        "value": "000001"
      }
    ],
    "shareText": "شرح نمونه"
  },
  "newReceipt": {
    "amount": 1000000,
    "bankUrl": "https://example.invalid/asset.png",
    "currency": "ریال",
    "details": [
      {
        "type": "KEY_VALUE",
        "key": "نمونه",
        "value": "نمونه"
      }
    ],
    "footerImageUrl": "https://example.invalid/asset.png",
    "header": "نمونه",
    "shareText": "شرح نمونه",
    "subtitle": "نمونه",
    "title": "نمونه",
    "trackingCode": "000000000001"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "transferDetail": {
    "sourceAccount": {
      "number": "123-456-0000001-2",
      "transferType": "DEPOSIT",
      "type": "DEPOSIT"
    },
    "destinationAccount": {
      "number": "123-456-0000001-2",
      "transferType": "DEPOSIT",
      "type": "DEPOSIT"
    },
    "destinationUser": {
      "fullName": ""
    },
    "currency": "IRR",
    "amount": 1000000,
    "id": 1,
    "paidDate": 1793500000000,
    "trackingCode": "000000000001"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 66. POST /transfers/iban

انتقال واقعی پایا با PAYA. مبدأ شماره حساب و مقصد شبای IR با checksum معتبر است. reasonCode از فهرست بابت انتخاب می‌شود؛ شرح بابت از بانک گرفته می‌شود. ساتنا و پل در این مسیر پیاده نشده‌اند.

| فیلد بدنه | نوع | الزامی | توضیح |
|---|---|---|---|
|source|string|بله||
|destination|string|بله||
|amount|integer|بله|IRR|
|description|string|خیر||
|trackerId|string|خیر||
|transactionPin|string|خیر|ورودی محرمانه؛ در پاسخ نمایش داده نمی‌شود. |
|isMostReferredDestination|boolean|خیر||
|reasonCode|string|بله||

**نمونهٔ درخواست:**

```http
POST /v1/transfers/iban HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{
  "source": "123-456-0000001-2",
  "destination": "IR220000000000000000000001",
  "amount": 100000,
  "reasonCode": "GPAC"
}
```

**نمونهٔ پاسخ 200:**

```json
{
  "receipt": {
    "title": "نمونه",
    "footerImage": "https://example.invalid/asset.png",
    "contents": [
      {
        "title": "نمونه",
        "value": "نمونه"
      }
    ],
    "footer": [
      {
        "title": "نمونه",
        "value": "000001"
      }
    ],
    "shareText": "شرح نمونه"
  },
  "newReceipt": {
    "amount": 1000000,
    "bankUrl": "https://example.invalid/asset.png",
    "currency": "ریال",
    "details": [
      {
        "type": "KEY_VALUE",
        "key": "نمونه",
        "value": "نمونه"
      }
    ],
    "footerImageUrl": "https://example.invalid/asset.png",
    "header": "نمونه",
    "shareText": "شرح نمونه",
    "subtitle": "IR220000000000000000000001",
    "title": "نمونه",
    "trackingCode": "000000000001"
  },
  "logLevel": "INFO",
  "status": {
    "code": 0,
    "message": "",
    "name": "OK"
  },
  "transferDetail": {
    "sourceAccount": {
      "number": "123-456-0000001-2",
      "transferType": "PAYA",
      "type": "PAYA"
    },
    "destinationAccount": {
      "number": "IR220000000000000000000001",
      "transferType": "PAYA",
      "type": "PAYA"
    },
    "destinationUser": {
      "fullName": ""
    },
    "currency": "IRR",
    "amount": 1000000,
    "id": 1,
    "paidDate": 1793500000000,
    "trackingCode": "000000000001"
  }
}
```

اعتبار نمونه: ساختار پاسخ موفق در فایل ضبط‌شده موجود است؛ مقادیر بالا ساختگی‌اند. این نشان‌دهندهٔ اجرای زندهٔ این نسخه در همین لحظه نیست.

## 67. POST /config

تبادل کلید را انجام می‌دهد و فقط وضعیت موفقیت را برمی‌گرداند. ورود خودش این مرحله را اجرا می‌کند؛ سرویس معمولاً نیازی به فراخوانی جداگانه ندارد.

**نمونهٔ درخواست:**

```http
POST /v1/config HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
Content-Type: application/json

{}
```

**نمونهٔ پاسخ 200:**

```json
{
  "configured": true,
  "appVersion": "5.8.2"
}
```

اعتبار نمونه: پاسخ محلی خود API؛ مسیرهای احراز هویت با بانک شبیه‌سازی‌شده تست شده‌اند.

## نام‌های جایگزین و سازگاری

| نام قدیمی | نام اصلی نسخه‌دار |
|---|---|
|/login|/v1/auth/login|
|/otp/request|/v1/auth/otp/request|
|/otp|/v1/auth/otp|
|/status|/v1/auth/session|
|/session/check|/v1/auth/session/check|
|/logout|/v1/auth/logout|
|/accounts|/v1/deposits|
|/transactions/detail/{id}|/v1/transactions/{id}|

تمام مسیرهای اصلی با و بدون /v1 کار می‌کنند. OpenAPI در GET /v1/openapi.json و فایل openapi.json پروژه قابل دریافت است.

## محدودیت‌های تأیید

ساختار انتقال کارت، DEPOSIT و PAYA با درخواست‌های موفق مرورگر مقایسه شده است. آزمون‌های این نسخه هیچ پولی منتقل نمی‌کنند. تست زندهٔ جدید با نشست منقضی ممکن نیست و نیازمند ورود مجدد است. تأیید قبلی endpointهای خواندنی و ساختار ضبط‌ها جایگزین تأیید اجرای انتقال توسط این نسخه نیست. پاسخ فیلدهای CVV2 رمزگذاری‌شده بدون کلید نشست قابل رمزگشایی نیست.
