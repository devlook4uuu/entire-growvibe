# E-Commerce Store

## Overview
GrowVibe has an integrated ecommerce store where students order products. There is no cart — every order is a single product. Delivery is only to the school. Admin manages all orders. Three payment types: full price (cash at school), coin discount (reduced cash), or voucher (free). Admin closes delivery week every Sunday to batch-process orders. Coin discount is max 20%.

## User Roles & Access
- **Admin:** Full order management — confirm, process, dispatch, deliver, return. Manage products.
- **All logged-in users:** Browse store and view products
- **Students:** Place orders with all 3 payment types (full price, coin discount, voucher)
- **Non-students (Owner/Principal/Coordinator/Teacher):** Browse and order — full price only
- **Owner/Principal/Coordinator:** View receipts when week is closed

## Core Functionality

### Ordering
- Browse product catalog with filters
- View product detail with payment options
- Place single-product order (no cart)
- 3 payment types: full price, coin discount, voucher
- Cancel order while PENDING (stock and coins refunded)
- Request return within 2 days of DELIVERED status

### Admin Order Management
- Confirm pending orders (after calling school)
- Assign delivery week on confirmation
- Close delivery week (Sunday) — batch moves CONFIRMED → IN_PROCESS
- Generate receipts for branch on week close
- Mark dispatched, delivered, returned
- Filter by school, status, delivery week

### Product Management (Admin)
- Add/edit products
- Set price, stock, eligibility flags (coin discount, basic voucher, premium voucher)
- Set `coin_discount_percent` (max 20%)
- Upload product images (minimum 1 required)
- Toggle product active/inactive
- Update stock count

## UI Screens & Components

### Screen: Store — Product List
**Visible To:** All logged-in roles

**Data Displayed:**
- Products grid: image, name, price, "Coin Discount X%" badge (if eligible)
- Stock status: In Stock / Out of Stock
- Filter: All / Coin Discount / Basic Voucher / Premium Voucher

**User Actions:**
- Tap product → Product Detail
- Filter products

**UX Flow:**
Open Store tab → products load → tap any product → detail screen

**Empty State:** "Abhi store mein koi product nahi."

**Edge Cases:**
- Out of stock: card dimmed + "Out of Stock" badge — tap still allowed but order button disabled
- Store only accessible to logged-in users

---

### Screen: Store — Product Detail
**Visible To:** All logged-in roles

**Data Displayed:**
- Product images (swipeable gallery)
- Name, description
- Price
- Payment options (if student): Full Price / Coin Discount (if eligible) / Use Basic Voucher / Use Premium Voucher
- Stock count
- "Order Now" button

**User Actions:**
- Select payment type → Order Now → confirmation modal → confirm → order placed

**UX Flow:**
Tap product → detail loads → student sees payment options → selects preferred → taps "Order Now" → confirmation modal shows final price → confirm → atomic transaction:
1. Stock `SELECT FOR UPDATE` (race condition prevention)
2. Stock decrement
3. Coins deduct (if applicable)
4. Order `INSERT`
→ Success screen

**Error States:**
- Out of stock → "Out of Stock — Order nahi ho sakta"
- Not enough coins → coin discount option disabled
- No eligible voucher → voucher options hidden
- Race condition (2 students last item) → one gets success, other gets "Item abhi out of stock ho gaya"

**Edge Cases:**
- Coin discount: coins deducted at order time
- Voucher: coins deducted at claim time (not order time — already deducted)
- Non-students: only full price option shown

---

### Screen: Order History (Student)
**Visible To:** Student only

**Data Displayed:**
- Orders list: product image, name, status badge (color-coded), order date, final price
- Status colors:
  - PENDING = yellow
  - CONFIRMED = blue
  - IN_PROCESS = orange
  - DISPATCHED = purple
  - DELIVERED = green
  - RETURNED = gray
- Expected delivery week (when confirmed): "Expected: Week of 24 March"

**User Actions:**
- Cancel order (PENDING only)
- Request Return (DELIVERED — within 2 days only)

**UX Flow:**
Student opens Orders → list of all orders → tap order for detail → cancel if PENDING

**Empty State:** "Koi orders nahi abhi tak. Store visit karo!"

**Error States:**
- Cancel attempt on non-pending → "Sirf pending orders cancel ho sakte hain"
- Return request after 2 days → "Return window 2 din mein close ho gaya"

**Edge Cases:**
- Coins refund on cancel (PENDING only)
- Return: no coins refund — no exceptions ever

---

### Screen: Admin — Orders Management
**Visible To:** Admin only

**Data Displayed:**
- Orders table: student name, school, branch, product, payment type, status, `delivery_week`
- Filters: school, status, `delivery_week`
- Summary: Pending X | Confirmed X | In Process X
- Current delivery week indicator

**User Actions:**
- Confirm order (PENDING → CONFIRMED + assign `delivery_week`)
- Mark Dispatched (CONFIRMED → DISPATCHED)
- Mark Delivered (→ DELIVERED)
- Mark Returned (→ RETURNED)
- "Close Week" button → processes all CONFIRMED orders

**UX Flow:**
Admin opens Orders → filters by status → confirms pending orders (after calling school) → Sunday: clicks Close Week → all CONFIRMED → IN_PROCESS → receipts generated → branch notifications sent

**Empty State:** "Koi orders nahi."

**Error States:**
- Close Week with no confirmed orders → "Is hafte koi confirmed order nahi" — friendly message, no error

**Edge Cases:**
- PENDING orders on week close: unaffected — stay pending for next week
- Close Week undo: feature to revert IN_PROCESS → CONFIRMED — marked as "decide later" in doc

---

### Screen: Admin — Products Management
**Visible To:** Admin only

**Data Displayed:**
- Products list: image, name, price, stock, active status
- 4 eligibility badges per product: Coin Discount / Basic Voucher / Premium Voucher
- "`coin_discount_percent`" value

**User Actions:**
- "+ Add Product" button
- Edit product
- Toggle active/inactive
- Update stock count

**UX Flow:**
Admin adds product → fills all fields including 4 eligibility toggles → sets `coin_discount_percent` (max 20%) → sets price → adds images → save

**Error States:**
- `coin_discount_percent` > 20 → "Maximum 20% discount allowed"
- No images → "Kam az kam ek image required hai"
- Stock negative → "Stock 0 se kam nahi ho sakta"

**Edge Cases:**
- Product inactive: hidden from store, but pending orders unaffected
- Stock 0: auto-shows "Out of Stock" badge

## Data & Fields
| Field | Description |
|---|---|
| status | Enum: PENDING / CONFIRMED / IN_PROCESS / DISPATCHED / DELIVERED / RETURNED |
| delivery_week | Assigned by Admin on confirmation — NULL on creation |
| payment_type | Enum: full_price / coin_discount / voucher_basic / voucher_premium |
| final_price | Actual amount after discount |
| coin_discount_percent | Max 20% — Admin set |
| `basic_voucher_eligible` | Boolean on product |
| `premium_voucher_eligible` | Boolean on product |
| stock | Integer — decremented on order, incremented on cancel |

**Key Indexes:** `(school_id, delivery_week)`, `(user_id, created_at)`

## Business Rules & Logic

### Order Status Flow
| Status | Set By | Cancellable? | Notes |
|---|---|---|---|
| PENDING | Auto on order create | YES — student cancel, stock back, coins back | `delivery_week = NULL` |
| CONFIRMED | Admin — after call | NO | `delivery_week` assigned here |
| IN_PROCESS | Admin — week close | NO | Receipt generated + push to branch |
| DISPATCHED | Admin — optional | NO | Useful for Lahore outstation |
| DELIVERED | Admin | NO | Return window 2 days opens |
| RETURNED | Admin — after physical return | N/A | Coins NOT refunded — ever |

### Payment Types
| Type | Who | Process | Actual Payment |
|---|---|---|---|
| Full Price | All roles | Normal order — no coins | Cash at school |
| Coin Discount | Students only | `discount_percent` applied → reduced price | Cash (discounted amount) at school |
| Voucher (Basic/Premium) | Students only | Eligible product free | No payment — voucher covers it |

- Stock race condition: `SELECT FOR UPDATE` on order placement
- Coin discount: max 20% — Admin-configurable per product
- Coin discount deducted at order time; voucher deducted at claim time
- PENDING cancel: stock restored + coins restored
- RETURNED: no coin refund — no exceptions
- Close Week: atomic — all CONFIRMED → IN_PROCESS + receipt generation + branch notifications

## API / Integrations
- **Edge Function:** `place-order` — atomic: stock FOR UPDATE + stock decrement + coins deduct + order INSERT
- **Edge Function:** `close-delivery-week` — batch process CONFIRMED → IN_PROCESS + generate receipts + send notifications
- **Edge Function:** `generate-fee-receipt` (or similar) — PDF receipt generation for week close
- **Expo Push Notifications:** Order confirmed, In Process, Delivered; Receipt ready to branch

## Open Questions / Missing Info
- "Close Week" — is this strictly Sunday, or can Admin close any day?
- "After calling school" — is there a built-in call/contact feature, or Admin calls manually and then confirms in system?
- Return flow: how does Admin physically confirm a return? Any notes/reason field?
- Close Week undo (IN_PROCESS → CONFIRMED): marked as "decide later" — needs decision
- Receipt format: what data exactly is on the "week close" receipt sent to branch?
- Can Admin partially confirm orders for a school (confirm some, leave others pending)?
- Stock: is it global or per-school? (Doc doesn't mention per-school stock)
- Product images: how many max? Stored in Supabase Storage?
- Coin discount applied to which base price — current price or a separate "original price"?
- `delivery_week` field format — is it a date, a week number, or a text like "Week of 24 March"?
