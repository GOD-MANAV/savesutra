# Set up the WhatsApp bot

The bot lets you keep doing what you already do (forward links on WhatsApp) while SaveSutra files them. It uses Meta's official **WhatsApp Cloud API**. Replies to messages you send are service messages: each business number gets **1,000 free service messages a month** (Meta pricing, from 1 Oct 2026).

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> → **Create app** → *Other* → *Business* → add the **WhatsApp** product.
2. In **WhatsApp → API Setup** you get a test number and a **Phone number ID**. Add your own phone as a recipient.
3. Create a **permanent access token**: Business Settings → System users → add a system user → generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. In **App settings → Basic**, copy the **App secret**.

## 2. Configure the server

```env
WHATSAPP_TOKEN=EAAG...                 # permanent token
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_APP_SECRET=abcdef...          # used to verify X-Hub-Signature-256
WHATSAPP_VERIFY_TOKEN=any-long-random-string
WHATSAPP_OWNER_NUMBER=919999999999     # your number, country code first, no +
```

Saves from `WHATSAPP_OWNER_NUMBER` go into the same library as your app. Add family with `WHATSAPP_ALLOWED_NUMBERS=91…,91…` (each gets a separate library).

## 3. Connect the webhook

1. In **WhatsApp → Configuration → Webhook**, set the callback URL to `https://YOUR-SERVER/webhooks/whatsapp` and the verify token to your `WHATSAPP_VERIFY_TOKEN`.
2. Subscribe to the **messages** field.
3. Send "hi" to the number. You'll get the welcome message with the privacy link.

## Commands

| Send | Bot does |
|---|---|
| any link (with optional text) | Saves it, text becomes the note, then replies with the summary when ready |
| `find goa cafés` (also `dhundo …`) | Top 5 matching saves |
| `more 129` or `#129` | Full details: summary, key points, places, links |
| `recent` | Last 5 saves |
| `delete 129` | Deletes #129 |
| `help` | Command list |
| `stop` / `start` | Deletes your WhatsApp saves and stops messages / resumes |

Anything else gets: *"I can only save links and search your saves."* This purpose limit keeps the bot within WhatsApp's 2026 policy on AI chatbots.
