<div dir="rtl">

# saman-api

<img src="assets/saman.svg" alt="Saman Bank Mobillet" width="64">

**رابط HTTP، ابزار خط فرمان و کتابخانهٔ پایتون برای اتصال به موبایلت بانک سامان.**

[English](README.md) · [فارسی](README.fa.md) · [مستندات آنلاین](https://apibank.heydari.workers.dev/saman/) · [راهنمای پایتون](https://apibank.heydari.workers.dev/saman/#python-sdk)

[![CI](https://github.com/DevURANIUM/saman-api/actions/workflows/ci.yml/badge.svg)](https://github.com/DevURANIUM/saman-api/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/saman-api)](https://pypi.org/project/saman-api/)
[![Python](https://img.shields.io/pypi/pyversions/saman-api)](https://pypi.org/project/saman-api/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

با **۶۷ عملیات HTTP مستندشده**، برنامهٔ خودتان را به موجودی سپرده‌ها و کارت‌ها، تاریخچه و جزئیات تراکنش‌ها، جست‌وجوی شمارهٔ پیگیری و انتقال وجه متصل کنید. برای استفادهٔ محلی، CLI مستقل Node.js و برای اتصال برنامه‌ها و سرویس‌ها، کلاینت‌های sync و async پایتون در دسترس‌اند.

این پروژه یک **یکپارچه‌سازی غیررسمی** است و به‌صورت مستقل نگهداری می‌شود؛ محصول رسمی یا مورد تأیید بانک سامان نیست.

## فهرست

- [نحوهٔ کار](#how-it-works)
- [قابلیت‌ها](#features)
- [شروع سریع](#quick-start)
- [ورود و مدیریت سشن](#authentication)
- [کتابخانهٔ پایتون](#python-client)
- [ابزارهای خط فرمان](#cli)
- [استفاده از HTTP API](#http-api)
- [تنظیمات](#configuration)
- [قرارداد داده‌ها و پاسخ‌ها](#conventions)
- [مستندات و نمونه‌ها](#documentation)
- [ساختار پروژه](#layout)
- [توسعه و تست](#development)
- [مشارکت و مجوز](#contributing)

<a id="how-it-works"></a>

## نحوهٔ کار

<div dir="ltr">

```text
Your application / Python SDK / Python CLI
                    |
                    v
        Your Node.js HTTP service
                    |
                    v
            Saman Mobillet API
```

</div>

| رابط | کاربرد | نیاز به سرور HTTP |
| --- | --- | --- |
| `node server.js` | اجرای ارتباط با بانک و ارائهٔ مسیرهای HTTP | سرور را اجرا می‌کند |
| `node cli.js` | کلاینت مستقل بانک با استفاده از سشن محلی | ندارد |
| `from samanapi import Client, AsyncClient` | اتصال برنامهٔ پایتون به سرویس HTTP شما | دارد |
| `saman-api` | ابزار خط فرمان نصب‌شده همراه بستهٔ پایتون | دارد |

سرویس Node.js ارتباط با بانک، رمزنگاری، کوکی‌ها و نگهداری سشن را مدیریت می‌کند. کتابخانهٔ پایتون درخواست‌های HTTP را به همین سرویس می‌فرستد. سایت مستندات، راهنما و نمونه‌ها را نمایش می‌دهد؛ درخواست‌های بانکی به سرویس خودتان ارسال می‌شوند.

**نام‌ها:** بسته را با نام `saman-api` از PyPI نصب کنید و در کد پایتون از `samanapi` استفاده کنید. نسخهٔ سرویس **۰٫۳٫۰** و نسخهٔ کتابخانهٔ پایتون **۰٫۱٫۰** است؛ این دو بخش شماره‌نسخهٔ جدا دارند.

<a id="features"></a>

## قابلیت‌ها

| بخش | امکانات |
| --- | --- |
| ورود | نام کاربری و رمز، درخواست خودکار پیامک دستگاه در صورت نیاز، تأیید کد، ادامهٔ ورود نیمه‌تمام و خروج |
| سشن | وضعیت محلی، اعتبارسنجی با بانک و تمدید با اطلاعات ورود تنظیم‌شده |
| حساب و کارت | سپرده‌ها، کارت‌های متصل، فهرست کامل کارت‌ها و سپرده‌ها، منتخب‌ها و موجودی گزارش‌شده |
| تراکنش | صفحه‌بندی، آخرین تراکنش‌ها، فیلتر تاریخ و مبلغ، جزئیات کامل و جست‌وجوی دقیق پیگیری یا مرجع |
| انتقال وجه | کارت‌به‌کارت، حساب‌به‌حساب و شبا/پایا؛ استعلام مالک، بابت انتقال و مقاصد اخیر |
| ریال دیجیتال | بررسی شرایط، پیامک فعال‌سازی، فعال‌سازی کیف CUSTOMER، موجودی، تاریخچه، مخاطبان، شارژ، برداشت و غیرفعال‌سازی |
| سرویس‌های دیگر | امتیاز سامانیوم، پایانه‌ها و خلاصهٔ فروشگاهی، مؤسسه‌ها و اطلاعات پشتیبانی‌شدهٔ داشبورد |
| ابزار توسعه | SDK همگام و ناهمگام، دو CLI، قرارداد OpenAPI 3.1، مجموعهٔ Postman، پاسخ کامل JSON و خطای ساختاریافته |

روش‌های ارسال انتقال بانکی این نسخه **CARD، DEPOSIT و PAYA** هستند. ارسال ساتنا و پل پیاده‌سازی نشده است. دسترسی، شرایط و سقف هر عملیات به حساب و پاسخ بانک بستگی دارد.

<a id="quick-start"></a>

## شروع سریع

پیش‌نیازها: **Node.js نسخهٔ ۲۲ یا جدیدتر**، **npm** و برای کتابخانهٔ پایتون، **Python نسخهٔ ۳٫۱۰ یا جدیدتر**.

### ۱. سرور HTTP را اجرا کنید

در PowerShell ویندوز:

<div dir="ltr">

```powershell
git clone https://github.com/DevURANIUM/saman-api.git
cd saman-api
npm ci

$env:SAMAN_HOST = "127.0.0.1"
$env:SAMAN_PORT = "8089"
$env:SAMAN_API_KEY = "REPLACE_WITH_YOUR_SERVICE_KEY"
npm start
```

</div>

برای کلید سرویس، یک مقدار طولانی و تصادفی انتخاب کنید و همان مقدار را در کلاینت‌ها بگذارید. این کلید برای دسترسی به HTTP API شماست؛ ورود بانک همچنان با نام کاربری، رمز و تأیید دستگاه انجام می‌شود.

<details>
<summary>متغیرهای محیطی در لینوکس و macOS</summary>

پس از دریافت پروژه و اجرای `npm ci`:

<div dir="ltr">

```sh
export SAMAN_HOST=127.0.0.1
export SAMAN_PORT=8089
export SAMAN_API_KEY='REPLACE_WITH_YOUR_SERVICE_KEY'
npm start
```

</div>

</details>

آدرس پیش‌فرض API برابر `http://127.0.0.1:8089/v1` و صفحهٔ ورود مرورگر برابر `http://127.0.0.1:8089/login` است.

### ۲. کتابخانهٔ پایتون را نصب کنید

در ترمینال دوم:

<div dir="ltr">

```powershell
python -m pip install saman-api
$env:SAMAN_API_URL = "http://127.0.0.1:8089/v1"
$env:SAMAN_API_KEY = "REPLACE_WITH_YOUR_SERVICE_KEY"
```

</div>

### ۳. وارد شوید و اطلاعات حساب را بگیرید

<div dir="ltr">

```python
from samanapi import Client

with Client() as client:
    session = client.sign_in()
    print(session["bankVerified"])
    print(client.deposits())
    print(client.cards())
    print(client.balance())
```

</div>

متد `sign_in()` نام کاربری، رمز مخفی و در صورت نیاز، کد پیامکی دستگاه را می‌پرسد. تمام پرسش‌ها و پیام‌های SDK و CLI انگلیسی‌اند. شناسه‌های مثال‌ها ساختگی‌اند؛ برای تاریخچه، سپردهٔ واقعی خودتان را از پاسخ انتخاب کنید.

<a id="authentication"></a>

## ورود و مدیریت سشن

برای برنامهٔ وب، مراحل را با API یا متدهای SDK جداگانه اجرا کنید:

1. متد `login(username, password)` یا مسیر `POST /v1/auth/login` را فراخوانی کنید.
2. اگر `otpRequired` و `otpSent` برابر true هستند، کد پیامک را در رابط برنامه بگیرید و به `verify_otp(code)` یا `POST /v1/auth/otp` بفرستید.
3. ورود کامل با `loggedIn=true` و `bankVerified=true` مشخص می‌شود. مقدار `ok=true` به‌تنهایی می‌تواند نشان‌دهندهٔ ورودِ منتظر تأیید دستگاه هم باشد.

پیامک دستگاه در صورت نیاز خودکار درخواست می‌شود. متد `request_otp()` برای ارسال مجددِ صریح است. ورود منتظر پیامک را می‌توان بدون شروع دوباره ادامه داد. تغییر رمز اجباری باید در برنامهٔ بانک تکمیل شود.

| متد پایتون | کاربرد |
| --- | --- |
| `status()` | خواندن وضعیت شناخته‌شدهٔ محلی سشن |
| `check_session()` | بررسی پذیرش سشن توسط بانک |
| `ensure_session()` | بررسی یا تمدید سشن؛ نتیجه ممکن است منتظر پیامک باشد |
| `logout()` | پاک‌کردن وضعیت ورود بانک در سرور |

هر سرور مالک **یک سشن بانکی مشترک** است. چند کلاینت پایتون متصل به یک سرور، از همان حساب استفاده می‌کنند. برای هر حساب مستقل، سرور و پوشهٔ دادهٔ جدا تنظیم کنید. بستن کلاینت پایتون، اتصال‌های HTTP را می‌بندد و باعث خروج حساب بانکی نمی‌شود.

جزئیات درخواست‌ها و پاسخ‌ها در [راهنمای ورود](docs/LOGIN-FLOW.fa.md) و [راهنمای HTTP](docs/API.md) آمده است.

<a id="python-client"></a>

## کتابخانهٔ پایتون

### تاریخچه و جست‌وجوی شمارهٔ مرجع

<div dir="ltr">

```python
from samanapi import Client

with Client() as client:
    deposit = "123-456-0000001-2"  # Replace with your selected deposit
    print(client.latest_transactions(deposit, limit=10))
    print(client.transactions(deposit, page=0, size=20, details=True))

    result = client.find_transaction(
        "000000000001", deposit,
        match_by="reference", pages=10, max_transactions=200,
    )
    print(result["found"], result["searchComplete"])
```

</div>

جست‌وجو دقیق و دارای سقف است. اگر `found` برابر false بود، پیش از نتیجه‌گیری دربارهٔ نبودن تراکنش، `searchComplete` و `stopReason` را بررسی کنید. متد `iter_transactions(..., max_pages=10)` پیمایش محدود تاریخچه را فراهم می‌کند و اگر نتواند در آن سقف تمام شود، `PaginationError` می‌دهد.

### نسخهٔ ناهمگام

<div dir="ltr">

```python
import asyncio
from samanapi import AsyncClient

async def main():
    async with AsyncClient() as client:
        print(await client.check_session())
        print(await client.cards())

asyncio.run(main())
```

</div>

نام و ورودی متدهای دو کلاینت یکسان است. برای پیمایش ناهمگام از `async for` استفاده کنید. اطلاعات ورود و کد پیامک را می‌توان با callback تأمین کرد؛ متد `AsyncClient.sign_in()`، callback ناهمگام را هم می‌پذیرد.

### مدیریت خطا

<div dir="ltr">

```python
from samanapi import Client, ApiError, TransportError

try:
    with Client() as client:
        print(client.balance())
except ApiError as error:
    print(error.status_code, error.code, error.next_action)
    # error.payload contains the complete service response.
except TransportError as error:
    print(error.request_may_have_succeeded)
```

</div>

تمام فیلدهای پاسخ حفظ می‌شوند. خطاهای API، پاسخ کامل و راهنمای ادامهٔ احراز هویت را نگه می‌دارند. SDK درخواست‌ها را خودکار تکرار نمی‌کند و تغییرمسیر HTTP را دنبال نمی‌کند. اگر نتیجهٔ یک انتقال مشخص نشد، پیش از ارسال دوباره، وضعیت آن را کنترل کنید.

توضیحات کامل نصب، callback، انتقال، کیف و خطاها: [راهنمای SDK](python/README.md) · [مرجع متدها](python/docs/reference.md).

<a id="cli"></a>

## ابزارهای خط فرمان

### CLI پایتون؛ از طریق سرور HTTP در حال اجرا

<div dir="ltr">

```powershell
saman-api login
saman-api status
saman-api check-session
saman-api deposits
saman-api cards
saman-api balance
saman-api latest-transactions --deposit-number "123-456-0000001-2" --limit 10
saman-api find-transaction "000000000001" --deposit-number "123-456-0000001-2" --match-by reference
saman-api --help
```

</div>

می‌توانید از `python -m samanapi` هم استفاده کنید. برای هر مسیر API یک فرمان وجود دارد؛ ورودی‌های آن را با `saman-api COMMAND --help` ببینید. اطلاعات محرمانهٔ ضروری کارت، اگر مشخص نشده باشند، بدون نمایش ورودی پرسیده می‌شوند. فرمان‌های مالی به تأیید `TRANSFER` و فعال‌سازی و غیرفعال‌سازی کیف به `ACTIVATE` و `DEACTIVATE` نیاز دارند.

### CLI مستقل Node.js

از ریشهٔ پروژه اجرا کنید:

<div dir="ltr">

```powershell
node cli.js login
node cli.js check-session
node cli.js deposits-all
node cli.js cards-all
node cli.js balance
node cli.js transactions-latest "123-456-0000001-2" 10
node cli.js transaction-find "000000000001" --account "123-456-0000001-2" --match-by reference
node cli.js help
```

</div>

CLI مستقل از همان پوشهٔ سشن سرور استفاده می‌کند. برای هر پوشهٔ داده، یک نویسنده اجرا کنید: پیش از فرمان‌های مستقلی که سشن را تغییر می‌دهند، سرور را متوقف کنید یا پوشهٔ جدا تنظیم کنید. CLI پایتون از طریق سرور در حال اجرا و صف درخواست‌های آن کار می‌کند.

هر دو CLI خروجی موفق JSON را روی stdout می‌نویسند. گزینهٔ `--json-errors` را پیش از نام فرمان بگذارید تا خطا به‌صورت JSON روی stderr با کد خروج ۱ برگردد.

<a id="http-api"></a>

## استفاده از HTTP API

اگر `SAMAN_API_KEY` تنظیم شده، هدر `x-api-key` را به درخواست‌های API اضافه کنید. مسیر سلامت بدون کلید در دسترس است؛ صفحهٔ ورود مرورگر نیز باز می‌شود تا کاربر کلید سرویسش را وارد کند. برای بدنهٔ POST از `Content-Type: application/json` استفاده کنید.

<div dir="ltr">

```powershell
curl.exe "http://127.0.0.1:8089/v1/health"
curl.exe "http://127.0.0.1:8089/v1/deposits" -H "x-api-key: YOUR_SERVICE_API_KEY"
curl.exe "http://127.0.0.1:8089/v1/transactions/latest?depositNumber=123-456-0000001-2&limit=10" -H "x-api-key: YOUR_SERVICE_API_KEY"
```

</div>

چند مسیر پرکاربرد در جدول زیر آمده است؛ قرارداد هر ۶۷ عملیات در [OpenAPI](docs/openapi.json) قرار دارد:

| روش | مسیر | کاربرد |
| --- | --- | --- |
| GET | `/v1/health` | سلامت سرویس |
| GET | `/v1/capabilities` | نگاشت قابلیت‌های CLI به HTTP |
| POST | `/v1/auth/login` | شروع ورود و درخواست پیامک دستگاه در صورت نیاز |
| POST | `/v1/auth/otp` | تأیید کد دستگاه |
| POST | `/v1/auth/session/check` | بررسی سشن با بانک |
| POST | `/v1/auth/session/ensure` | بررسی یا تمدید سشن |
| GET | `/v1/deposits/all` | فهرست کامل سپرده‌ها |
| GET | `/v1/cards/all` | فهرست کامل کارت‌ها |
| GET | `/v1/balance` | موجودی گزارش‌شدهٔ کارت‌ها و سپرده‌ها |
| GET | `/v1/transactions/latest` | آخرین تراکنش‌های سپردهٔ انتخاب‌شده |
| GET | `/v1/transactions/{id}` | جزئیات کامل تراکنش |
| GET | `/v1/transactions/find/{code}` | جست‌وجوی دقیق پیگیری یا مرجع |
| POST | `/v1/transfers/card` | ارسال انتقال کارت‌به‌کارت |
| POST | `/v1/transfers/deposit` | ارسال انتقال حساب‌به‌حساب |
| POST | `/v1/transfers/iban` | ارسال انتقال شبا/پایا |
| GET | `/v1/digital-rial/wallets` | فهرست کیف‌های ریال دیجیتال |

<a id="configuration"></a>

## تنظیمات

| متغیر | مصرف‌کننده | مقدار پیش‌فرض یا کاربرد |
| --- | --- | --- |
| `SAMAN_HOST` | سرور Node.js | `127.0.0.1` |
| `SAMAN_PORT` | سرور Node.js | `8089` |
| `SAMAN_API_KEY` | سرور و کلاینت پایتون | کلید مشترک سرویس؛ برای گوش‌دادن سرور خارج از localhost الزامی است |
| `SAMAN_DATA_DIR` | سرور و CLI مستقل | پوشهٔ `data/` در ریشهٔ پروژه؛ محل اطلاعات سشن |
| `SAMAN_USER` و `SAMAN_PASS` | تمدید Node.js و ورود CLI پایتون | اطلاعات ورود اختیاری از محیط فرایند |
| `SAMAN_API_URL` | کلاینت و CLI پایتون | `http://127.0.0.1:8089/v1` |

متغیرهای پشتیبانی‌شده در [`.env.example`](.env.example) آمده‌اند. برنامه فایل `.env` را **خودکار بارگذاری نمی‌کند**؛ متغیرها را در shell یا مدیر فرایند تنظیم کنید. برای اتصال میان دستگاه‌ها از HTTPS استفاده کنید و فایل‌های سشن، ضبط خصوصی و اطلاعات ورود را وارد گیت نکنید.

در صورت وجود اطلاعات ورود، سرور ممکن است یک درخواست خواندنی را پس از خطای صریح ۴۰۱ بانک، یک بار با تمدید سشن تکرار کند. انتقال‌ها و دیگر درخواست‌های نوشتنی خودکار تکرار نمی‌شوند. خود SDK پایتون نیز درخواست‌ها را خودکار تکرار نمی‌کند.

<a id="conventions"></a>

## قرارداد داده‌ها و پاسخ‌ها

- مبلغ، عدد صحیح **ریال** است؛ تومان نیست و باید در محدودهٔ عدد صحیح امن JavaScript باشد.
- شمارهٔ کارت، سپرده، شبا، شناسهٔ تراکنش و شمارهٔ پیگیری را **رشته** بفرستید تا صفرهای ابتدایی و شناسه‌های غیرعددی حفظ شوند.
- صفحهٔ اول تاریخچه **۰** است. تاریخ تراکنش بر حسب Unix **ثانیه** و `fromDate` خلاصهٔ پایانه بر حسب **میلی‌ثانیه** است.
- فیلدهای کامل پاسخ حفظ می‌شوند. مقدار null در پایتون `None` می‌شود و فیلد غایب همچنان غایب می‌ماند.
- موجودی نامشخص به صفر تبدیل نمی‌شود و موجودی کارت و سپرده با هم جمع نمی‌شوند.
- گزینهٔ `details=True` جزئیات تاریخچه را دریافت می‌کند. اطلاعات واریزکننده یا طرف مقابل، در صورت ارائه توسط بانک برگردانده می‌شوند و از روی شرح حدس زده نمی‌شوند.
- خطای بانک، کد و جزئیات موجود را حفظ می‌کند؛ پیش از تکرار درخواست، پاسخ خطای مستندشده را بررسی کنید.

<a id="documentation"></a>

## مستندات و نمونه‌ها

| منبع | لینک |
| --- | --- |
| مستندات تعاملی فارسی | [سایت APIBANK](https://apibank.heydari.workers.dev/saman/) |
| راهنمای تعاملی پایتون | [نصب، ورود، async و نگاشت متدها](https://apibank.heydari.workers.dev/saman/#python-sdk) |
| بستهٔ پایتون | [PyPI: saman-api](https://pypi.org/project/saman-api/) |
| راهنمای اتصال HTTP | [docs/API.md](docs/API.md) |
| مرجع کامل درخواست و پاسخ فارسی | [docs/API-REFERENCE.fa.md](docs/API-REFERENCE.fa.md) |
| قرارداد OpenAPI 3.1 | [docs/openapi.json](docs/openapi.json) |
| مجموعهٔ Postman | [دریافت مجموعه](docs/saman-api.postman_collection.json) |
| مرجع متدهای پایتون | [python/docs/reference.md](python/docs/reference.md) |
| نمونه‌های قابل اجرا | [example/README.md](example/README.md) |

در Postman متغیرهای مجموعه، یعنی `baseUrl` و `apiKey` را با مقادیر سرویس خودتان تنظیم کنید. نمونه‌ها دادهٔ ساختگی دارند و درخواست‌ها خودکار اجرا نمی‌شوند.

<a id="layout"></a>

## ساختار پروژه

<div dir="ltr">

```text
saman-api/
├── src/                  Bank client, auth, validation and response handling
│   └── auth-ui/          Browser login page assets
├── python/               Installable saman-api package; import samanapi
├── example/              Usage scripts and synthetic response examples
├── docs/                 HTTP reference, OpenAPI, Postman and workflow guides
├── test/                 Offline Node.js tests
├── scripts/              Documentation export tools
├── .github/workflows/    CI and manual PyPI publishing
├── .env.example          Environment variable reference
├── cli.js                Standalone CLI entry point
├── server.js             HTTP service entry point
└── test-api.js           Node test runner
```

</div>

<a id="development"></a>

## توسعه و تست

<div dir="ltr">

```powershell
npm ci
npm test
python -m pip install -e ./python
python -m unittest discover -s python/tests -v
```

</div>

تست یکپارچهٔ پایتون با سرور، به وابستگی‌های Node.js نیاز دارد. تست‌ها از بانک شبیه‌سازی‌شده و انتقال HTTP ساختگی استفاده می‌کنند و انتقال بانکی زنده انجام نمی‌دهند. CI، سرور و SDK را روی ویندوز و لینوکس با پایتون ۳٫۱۰ و ۳٫۱۴ بررسی می‌کند؛ این بررسی شامل lint، نوع‌ها، وابستگی‌ها، ساخت بسته و نصب wheel است.


<a id="contributing"></a>

## مشارکت و مجوز

برای گزارش مشکل، مسیر یا متد، رفتار مورد انتظار و خطای پاک‌سازی‌شده از اطلاعات شخصی را بنویسید. تغییرات رفتاری باید تست مرتبط و مستندات به‌روز داشته باشند. [فایل مشارکت‌کنندگان](CONTRIBUTORS.md) را ببینید.

پروژه با [مجوز MIT](LICENSE) منتشر شده است.

</div>
