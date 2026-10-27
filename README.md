<p align="center">
  <a href="https://lemura.ir"><img src=".github/hero.svg" alt="Lemura AI — هوش مصنوعی لمورا" width="100%"></a>
</p>

<p align="center">
  <a href="https://lemura.ir"><img src="https://img.shields.io/badge/LIVE-lemura.ir-7C3AED?style=for-the-badge&labelColor=090611" alt="lemura.ir"></a>
  <img src="https://img.shields.io/badge/UI-Persian%20%C2%B7%20RTL-A855F7?style=for-the-badge&labelColor=090611" alt="Persian RTL">
  <img src="https://img.shields.io/badge/API-OpenAI%20compatible-F87171?style=for-the-badge&labelColor=090611" alt="OpenAI compatible">
  <img src="https://img.shields.io/badge/Theme-Dark%20Purple-753E79?style=for-the-badge&labelColor=090611" alt="Dark purple theme">
</p>

<div dir="rtl">

## ⚡ لمورا چیست؟

**هوش مصنوعی لمورا** یک پلتفرم فارسی هوش مصنوعی به سبک ChatGPT است: با بهترین مدل‌های دنیا گفتگو کن،
وسط همان گفتگو بگو «یک تصویر بساز» تا تصویر ساخته شود، برای برنامه‌هایت کلید API بگیری و هزینه‌ها را از
کیف پول تومانی خودت پرداخت کنی؛ همه با رابط راست‌چین، فونت وزیر و تم تیره بنفش.

<p align="center"><b>👈 همین حالا امتحان کن: <a href="https://lemura.ir">lemura.ir</a></b></p>

> [!TIP]
> **📘 مستندات کامل وب‌سرویس:** [`docs/index.html`](docs/index.html) (نسخه گرافیکی، ۱۷ بخش) ·
> [`docs/lemura-gateway-api.txt`](docs/lemura-gateway-api.txt) (نسخه متنی ساده) ·
> [نسخه آنلاین روی lemura.ir/docs](https://lemura.ir/docs)

> [!NOTE]
> این مخزن فقط **بخش فرانت‌اند** لمورا است: قالب‌های صفحه (Jinja2)، استایل‌ها، اسکریپت‌های مرورگر و فونت‌ها.
> کد سرور، پنل مدیریت، درگاه پرداخت، اتصال پیامک، کلیدها و تنظیمات عمداً در این مخزن **نیستند**.

</div>

<p align="center">
  <a href="https://lemura.ir"><img src=".github/features.svg" alt="Lemura features" width="100%"></a>
</p>

<div dir="rtl">

## ✨ امکانات

| | بخش | توضیح |
|:-:|---|---|
| 🗨️ | **گفتگوی هوشمند** | رابط به سبک ChatGPT، پاسخ زنده (streaming)، انتخاب مدل بر اساس سازنده، Markdown و کد رنگی، جستجوی وب، اشتراک‌گذاری گفتگو |
| 🎨 | **تصویر داخل گفتگو** | کافی است بنویسی «یک تصویر بساز از …»؛ تصویر در همان گفتگو ساخته می‌شود |
| 🖼️ | **استودیو تصویر** | ساخت تصویر با متن فارسی، انتخاب مدل و ابعاد، گالری شخصی |
| 🧑‍💻 | **توسعه‌دهندگان** | کلیدهای `lsk-`، آمار مصرف، شروع سریع و [مستندات کامل](docs/index.html)؛ سازگار با OpenAI SDK |
| 👛 | **کیف پول** | شارژ آنلاین به تومان، پرداخت به اندازه مصرف و تاریخچه تراکنش‌ها |
| 🔐 | **ورود و ثبت‌نام یکپارچه** | یک فرم واحد: موبایل یا ایمیل ← رمز عبور یا کد پیامکی؛ ورود با گوگل |
| 👤 | **حساب کاربری** | تصویر پروفایل، نام نمایشی و رمز عبور |

</div>

## 🧑‍💻 Developer API · <span dir="rtl">API برای توسعه‌دهندگان</span>

Lemura exposes an **OpenAI-compatible** gateway. Point the official SDK at Lemura and use your
`lsk-` key from [lemura.ir/developers](https://lemura.ir/developers) — nothing else changes.

📘 **Full API reference:** [`docs/index.html`](docs/index.html) · plain text: [`docs/lemura-gateway-api.txt`](docs/lemura-gateway-api.txt) · online: [lemura.ir/docs](https://lemura.ir/docs)

```python
from openai import OpenAI

client = OpenAI(base_url="https://lemura.ir/wp-json/lemuraai/v1", api_key="lsk-YOUR-KEY")

reply = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "سلام! یک شعر کوتاه درباره پاییز بنویس."}],
    stream=True,
)
for chunk in reply:
    print(chunk.choices[0].delta.content or "", end="")
```

| Endpoint | Purpose |
|---|---|
| `POST /chat/completions` · `/responses` | Chat, with streaming |
| `POST /images/generations` | Image generation |
| `POST /audio/speech` · `/audio/transcriptions` | Text-to-speech and speech-to-text |
| `POST /embeddings` · `/moderations` | Embeddings and moderation |
| `POST /web-search` · `/web-scrape` · `/research` | Live web search, page reading and research |
| `POST /videos` | Video generation (create, remix, download) |
| `GET /models` · `/balance` · `/usage` · `/me` · `/ping` | Models & prices, balance, usage history, key info, health |

<div dir="rtl">

> هزینه هر درخواست به تومان از کیف پول کم می‌شود؛ درخواست‌های ناموفق هزینه‌ای ندارند.

</div>

## 🗂️ Repository layout · <span dir="rtl">ساختار مخزن</span>

```text
docs/
├── index.html               # standalone API reference (17 sections) — open in any browser
└── lemura-gateway-api.txt   # the same reference as plain text
templates/
├── app/
│   ├── base.html            # app shell: sidebar (new chat, pages, conversations), top bar, account menu
│   ├── chat.html            # ChatGPT-style chat (home "/"), model picker, in-chat image generation
│   ├── images.html          # image studio + personal gallery
│   ├── developers.html      # API keys, usage stats, quick start
│   ├── docs.html + docs/    # API documentation page (rendered at /docs)
│   ├── wallet.html          # balance, top-up, transactions
│   ├── account.html         # profile, password, sign-in methods
│   ├── auth.html            # unified sign-in / sign-up dialog (+ Google)
│   ├── login_req.html       # "sign in to continue"
│   └── icons.html           # inline SVG icon macro
├── base.html · shared.html  # read-only shared-conversation page
static/
├── css/    theme.css (tokens) · app.css (app layout) · chat.css (shared page)
├── js/     app.js (shell, sidebar, conversations) · app-chat.js (streaming chat + images)
│           md.js (safe Markdown rendering) · auth.js (sign-in dialog)
├── vendor/ marked · highlight.js
├── fonts/  Vazir (woff2)
└── img/    avatar.svg
```

## 🎨 Design tokens · <span dir="rtl">رنگ‌ها و فونت</span>

| Token | Value | |
|---|---|---|
| Background | `#090611` | ![](https://img.shields.io/badge/-%20%20%20%20-090611?style=flat-square) |
| Accent | `#7C3AED` | ![](https://img.shields.io/badge/-%20%20%20%20-7C3AED?style=flat-square) |
| Accent (deep) | `#753E79` | ![](https://img.shields.io/badge/-%20%20%20%20-753E79?style=flat-square) |
| Coral | `#F87171` | ![](https://img.shields.io/badge/-%20%20%20%20-F87171?style=flat-square) |
| Font | **Vazir** | <span dir="rtl">راست‌چین، اعداد فارسی</span> |

## 🛠️ Tech · <span dir="rtl">فناوری</span>

- **Templates:** Jinja2 (rendered by a Python / Flask backend that is not part of this repository)
- **Front-end:** vanilla JavaScript and CSS (plus marked + highlight.js for Markdown and code), Server-Sent Events for streaming
- **Layout:** RTL-first, responsive from phones to wide screens, dark theme

<div dir="rtl">

## 🔒 امنیت

در این مخزن هیچ کلید، رمز، اطلاعات درگاه پرداخت یا پنل پیامک وجود ندارد. اگر مشکل امنیتی در
[lemura.ir](https://lemura.ir) پیدا کردی، لطفاً آن را به‌صورت خصوصی گزارش کن و در Issues عمومی منتشر نکن.

---

<p align="center">
  ساخته‌شده با 💜 برای کاربران فارسی‌زبان<br>
  <a href="https://lemura.ir"><b>lemura.ir</b></a>
</p>

</div>

<sub>Vazir font © Saber Rastikerdar, SIL Open Font License 1.1 · marked (MIT) · highlight.js (BSD-3-Clause).</sub>
