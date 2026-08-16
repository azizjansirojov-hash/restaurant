# Emergent Master Prompt — Lale

Copy everything below the line into Emergent as a single prompt.

---

Build a production-ready mobile app called **Lale** — a pickup-first ordering, reservation, and loyalty app for guests of a modern Anatolian neighborhood restaurant, killing third-party delivery commissions, chaotic phone orders during Friday–Saturday rush, and weekend reservation no-shows by owning the reorder channel on the guest’s phone.

## Brand and design direction

**Reference vibes (mood only, do not copy UI):** Aesop’s quiet packaging discipline + late-night Istanbul meyhane glow + Dishoom’s confident restraint. Warm, editorial, intimate — never generic “modern clean,” never purple gradients, never cream-and-terracotta cliché, never dashboard-as-home.

**Palette (use exact hex):**
- Charcoal background / primary text on light: `#1A1614`
- Warm stone surface: `#E8E0D5`
- Pomegranate accent / primary CTA: `#9B2D35`
- Olive leaf secondary accent: `#3F5A45`
- Soft cream text on dark: `#F5F0E8`
- Hairline borders / dividers: `#C9BEB0`

**Typography:**
- Display / brand / section titles: **Fraunces** (soft editorial serif)
- UI / body / buttons / labels: **Satoshi** (if unavailable, **General Sans**)
- Never Inter, Roboto, Arial, or system default stacks

**Visual composition rules:**
- Home = one composition: full-bleed edge-to-edge food hero, **Lale** wordmark as the dominant brand signal, support line exactly **“Anatolian grill & meze — order direct.”**, one primary CTA (“Order pickup”). Secondary text link under CTA: “Reserve a table”. No cards in the hero. No stats, schedules, address blocks, or promo chips on the first viewport.
- Cards only where interaction requires a container (cart line items, reservation slots, kitchen tickets). If border/shadow/radius can be removed without hurting clarity, remove them.
- Real food photography as the visual anchor — charcoal grill, meze, flatbread — not abstract gradients.
- Light-forward surfaces (`#E8E0D5`) with charcoal type (`#1A1614`); pomegranate (`#9B2D35`) for CTAs; olive (`#3F5A45`) for success/loyalty moments only.

**Motion (ship all three):**
1. Slow ken-burns on the home hero image
2. Cart “Complete the table” upsell sheet slides up before payment
3. Order status steps morph between states; loyalty ring fills on earn

## Business bottleneck and success metrics

**What is costing money now:**
1. Aggregator commissions (~25–30%) on delivery/pickup routed through DoorDash/Uber Eats
2. Missed and wrong phone orders during peak dinner when the line is jammed
3. Weekend reservation no-shows that burn covers and labor

**App kills those by:** direct paid pickup orders, structured menu+modifiers (no verbal mistakes), reservation reminders + optional peak deposit hold, and loyalty that pulls guests back without ads.

**Owner success metrics (show in owner analytics, day view):**
- Direct orders count and GMV (gross merchandise value)
- Average order value (AOV) and tip total
- Upsell attach rate (% of orders with an upsell item)
- Reservation no-show rate
- Loyalty earn vs redeem and repeat-order rate (guest with 2+ completed orders / 30 days)

## Who uses it and how (mobile moments)

### Guest (primary)
- Phone OTP login; profile stores name + push token + loyalty balance
- Moment A: walking or in-car, 30–90 seconds — opens app → Order pickup → picks favorites/modifiers → pays → gets Ready push → walks in
- Moment B: planning Friday dinner — Reserve table → picks party size + slot → gets reminder 2h before → seats
- Moment C: after a few visits — sees loyalty ring on home → redeems at checkout for $10 off

### Staff — kitchen / host
- Kitchen board: live unpaid-blocked tickets only for **paid** orders; bump Received → Preparing → Ready → Completed
- Host board: tonight’s reservations; mark Seated / No-show / Cancelled

### Owner
- Toggle item sold-out (`isAvailable`)
- Hours, pickup ETA minutes, delivery on/off, tip presets, loyalty rate, Fri–Sat peak deposit on/off + amount
- Promo codes; day sales snapshot (orders, GMV, AOV, tips, no-shows)

## Core features (exactly five — build all, connect them)

### 1) Menu + cart + checkout (pickup-first)
- Seed categories exactly: Meze, Grill, Flatbreads, Desserts, Drinks — ≥4 items each, with images, allergens, and at least one required modifier on Grill items (e.g. spice level / doneness)
- Default fulfillment: **Pickup**. Delivery UI and address fields exist only if `RestaurantSettings.deliveryEnabled === true` (default **false**)
- Happy path: browse → add with modifiers → cart → **mandatory “Complete the table” sheet** once before pay (2–3 items with `upsellTags` including `complete_the_table`: Ayran, Baklava, Extra flatbread) → tip → pay
- Tip presets: **15% / 18% / 20% / Custom**, default selected **18%**; tip is calculated on post-discount subtotal
- Tax: apply a single configurable `taxRatePercent` from settings (seed **8.875%**) on post-discount subtotal; tip is after tax display but not taxed
- Promo field: one promo code **OR** loyalty redeem per order (never both); if guest selects both, keep the last choice and clear the other with inline explanation
- Checkout line copy: “Order direct — skip the wait”
- Successful payment creates `Order` with status `received` (there is no separate unpaid kitchen state)

### 2) Live order status + Ready push
- Status machine: `received` → `preparing` → `ready` → `completed` (also `cancelled` by staff/owner only; cancelled orders never earn loyalty)
- Guest lands on Order Status immediately after pay
- Staff advances **one step at a time** only (no skipping). Each bump is a single explicit action on the ticket
- On transition to `ready`: set `readyAt`; push title/body **“Lale — your order is ready for pickup”**
- On transition to `completed`: set `completedAt`; credit loyalty (feature 4)

### 3) Reservations + reminders
- Party size **1–8**; slots every **15 minutes** within today’s/open hours; each slot capacity **default 4 parties** (settings: `slotCapacity`)
- Status: `booked` → `reminded` → `seated` | `no_show` | `cancelled`
- Automated job **2 hours before** `slotStart`: set `reminded` + push/SMS **“See you at Lale in 2 hours”**
- Peak window (hardcoded for deposit logic): **Friday & Saturday 17:00–21:00** restaurant timezone. If `peakDepositEnabled`, require authorization hold of `peakDepositCents` (seed **$25**) at book; on `no_show` set `depositForfeited=true` and capture hold; on `seated` or cancel ≥2h before slot, release hold
- Guest may cancel from Profile → upcoming reservation; host marks seated/no-show/cancelled from board

### 4) Loyalty
- Earn **1 point per full $1** of `subtotalCents - discountCents` (exclude tip and tax), floor to integer, when order reaches `completed`
- Redeem **100 points = $10** (`loyaltyRedeemValueCents=1000`) at checkout in whole 100-point blocks only; cannot redeem more than balance or more than subtotal
- Append-only `LoyaltyLedger`; never change `loyaltyBalance` without a ledger row in the same transaction
- Progress ring on **Home** and **Checkout**: “You’re X points from $10 off” (X = points remaining to next 100-block)
- Reservations never earn points; only `completed` orders earn

### 5) Staff / owner console
- Kitchen: filter today’s orders; bump status; cancel with reason
- Host: reservation board for selected date
- Owner: menu CRUD + sold-out toggles; settings; promo codes; day analytics
- Staff cannot edit menu prices or settings; owner can

## Screen map

**Guest:** Splash/OTP → Home (hero + Order pickup CTA + loyalty ring + Reserve link) → Menu → Item detail/modifiers → Cart → Complete-the-table upsell sheet → Checkout (tip, promo/loyalty, pay) → Order status → Order history → Reserve flow → Profile  
**Staff:** Login → Kitchen board | Host board  
**Owner:** Staff screens + Menu manager + Settings + Promos + Day analytics  

## Data model

**User:** id, phone, name, role (`guest|staff|owner`), loyaltyBalance, pushToken, createdAt  
**MenuCategory:** id, name, sortOrder  
**MenuItem:** id, categoryId, name, description, priceCents, imageUrl, allergens[], modifiers[], upsellTags[], isAvailable, sortOrder  
**Modifier:** id, name, required, options[{name, priceCents}]  
**Cart / CartItem:** userId, items with selected modifiers, fulfillmentType (`pickup|delivery`)  
**Order:** id, userId, status (`received|preparing|ready|completed|cancelled`), fulfillmentType, subtotalCents, taxCents, tipCents, discountCents, totalCents, promoCodeId?, loyaltyRedeemedPoints?, paymentIntentId, createdAt, readyAt?, completedAt?  
**OrderItem:** orderId, menuItemId, nameSnapshot, unitPriceCents, modifiersSnapshot, quantity  
**Reservation:** id, userId, partySize, slotStart, status (`booked|reminded|seated|no_show|cancelled`), depositHoldCents?, depositForfeited bool, createdAt  
**LoyaltyLedger:** id, userId, orderId?, deltaPoints, reason (`earn|redeem|adjust`), createdAt  
**PromoCode:** id, code, type (`percent|fixed`), value, active, maxRedemptions?, redemptionCount  
**RestaurantSettings:** single row — displayName `Lale`, address string, hours[] (seed Tue–Sun 12:00–22:00, closed Monday), timezone `America/New_York`, pickupEtaMinutes `25`, deliveryEnabled `false`, taxRatePercent `8.875`, tipPresets `[15,18,20]`, defaultTipPercent `18`, loyaltyEarnPerDollar `1`, loyaltyRedeemBlock `100`, loyaltyRedeemValueCents `1000`, peakDepositEnabled `false`, peakDepositCents `2500`, slotCapacity `4`

### Triggers
- Payment success → Order `received` → kitchen board  
- Order → `ready` → push guest; set `readyAt`  
- Order → `completed` → LoyaltyLedger earn + increment `loyaltyBalance`; set `completedAt`  
- Checkout loyalty redeem (before pay) → hold points in UI; on payment success write LoyaltyLedger redeem + decrement balance; on pay failure release hold with no ledger row  
- Reservation create → consume one unit of slot capacity for that `slotStart`  
- T-minus 2h → `reminded` + push/SMS  
- Host `no_show` → if deposit hold exists, capture + `depositForfeited=true`  

## Monetization UX rules (bake into flows, not a “Monetization” settings tab for guests)

1. Direct checkout is the default path; never deep-link guests to third-party aggregators  
2. Force the upsell sheet once per checkout before payment (dismissible, but must be shown)  
3. Default tip 18% pre-selected  
4. Loyalty ring + “You’re X points from $10 off” on home and checkout  
5. Peak deposit only when owner enables it — do not surprise guests on weekday lunch  
6. No ads, no guest subscription paywall, no in-app banners unrelated to ordering/reserving  

## Roles and permissions

| Action | Guest | Staff | Owner |
|---|---|---|---|
| Browse menu / cart / pay | yes | — | — |
| Place reservation | yes | — | — |
| Bump order status / cancel order | — | yes | yes |
| Mark reservation seated/no-show | — | yes | yes |
| Toggle sold-out / edit menu | — | — | yes |
| Edit settings / promos / analytics | — | — | yes |

## Technical expectations (Emergent)

- Cross-platform mobile app (React Native / Expo-style), iOS + Android  
- Phone OTP auth; secure session  
- Payments: card checkout for orders; support authorization hold for peak reservation deposit when enabled (Stripe or Emergent-equivalent)  
- Push notifications for order Ready + reservation reminder (SMS fallback for reminder if push unavailable)  
- Persistent backend with the data model above; seed Lale menu categories Meze / Grill / Flatbreads / Desserts / Drinks (≥4 items each) with images and modifiers; seed one `owner` and one `staff` test account documented on the login/staff entry screen  
- Same app binary: role-gated tabs after OTP (`guest` vs `staff`/`owner`); staff/owner do not see guest cart checkout as their home  
- Loading, empty, and error states for menu, cart pay failure, and no available reservation slots  
- Accessibility: sufficient contrast on charcoal/cream; CTA hit targets ≥ 44pt  

## Do not build (v1)

- Full POS / table-side payment / printer hardware integrations  
- Multi-location / franchise admin  
- Social feed, stories, chat with the restaurant, or community forum  
- Grocery / marketplace / catering portal  
- Crypto, wallets, or NFT loyalty  
- Dark-mode-only skin or purple/glow “AI default” aesthetic  
- Inter/Roboto/system fonts  
- Hero clutter: stats strips, floating badges, promo stickers on hero imagery  
- More than the five core features above  
- Guest freemium walls or ads  

## Acceptance criteria — “production-ready first shot”

1. Guest can OTP in, browse seeded menu, add modifiers, pass upsell sheet, tip at 18% default, pay, and see order status update when staff bumps to Ready (with push).  
2. Completing an order credits loyalty at 1 pt/$1; redeeming 100 pts applies $10 off; ledger rows exist for both.  
3. Guest can book a reservation; 2h reminder fires; host can mark seated or no-show.  
4. Owner can mark an item sold-out and it disappears or shows unavailable in guest menu immediately.  
5. Home matches brand: full-bleed hero, Lale wordmark dominant, Fraunces + Satoshi/General Sans, exact hex palette, single Order pickup CTA — no hero cards or stat clutter.  
6. Delivery UI hidden unless owner enables delivery.  
7. No items from the Do-not-build list ship in v1.  

Ship polished empty/error states, realistic seed data, and staff + guest paths working end-to-end without placeholder “lorem” restaurant naming — the restaurant is **Lale**.
