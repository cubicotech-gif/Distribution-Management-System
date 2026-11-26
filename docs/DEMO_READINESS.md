# Demo readiness checklist

Status: ✅ done · 🟡 partly done · ⬜ not started
Built department by department. Nothing moves to the next department until the current one passes its own checklist and the universal checklist.

---

## A. Universal quality (every screen, every department)

### Loading and waiting
- ⬜ Skeleton placeholders that match the layout while a screen loads (minimum ~300 ms so they never flicker)
- ⬜ Spinner inside a button while an action runs; button disabled so it cannot be double-clicked
- ⬜ No layout jump when data arrives (fixed heights for tables, cards, charts)
- ⬜ Fast first paint: fonts preloaded, no flash of unstyled content, no blank white screen between pages
- ⬜ Optimistic updates (row changes at once, rolls back with a message if it fails)
- ⬜ Progress feedback for long actions (CSV import, bulk price update, print)

### Empty, error and edge states
- ✅ Empty states with a reason (partly: some are only a title). ⬜ Every one gets a reason **and** a primary action
- ⬜ Error ladder: inline field errors, toast with retry for recoverable errors, banner for page problems, full screen for unrecoverable
- ⬜ Custom 404 and "something went wrong" pages with a way back
- ⬜ Offline / connection-lost banner
- ⬜ Very long names, very large numbers, zero values, negative values, missing data: all checked on every table
- ⬜ Large data: 500+ products, 2,000+ orders stay fast (pagination or virtual lists)

### Forms
- 🟡 Validate on blur, not on every keystroke; keep what the user typed after an error; specific messages ("Expiry is in the past", not "Invalid")
- ⬜ Required-field markers, numeric limits, duplicate-code check, unsaved-changes warning on close
- ⬜ Enter submits, Esc cancels, sensible Tab order, autofocus on the first field

### Safety and feedback
- 🟡 Toast after every action. ⬜ Undo for reversible actions (delete, status change)
- ⬜ Confirm dialog for destructive or irreversible actions, naming exactly what will happen
- ⬜ Permission feedback: a hidden or disabled button always says why on hover
- ⬜ Audit trail on every business document (who, when, what changed)

### Look and consistency
- ✅ One design system, light and dark mode. ⬜ Check every screen in dark mode
- ⬜ Same date, number and currency format everywhere; right-aligned numbers; timestamps relative with exact time on hover
- ⬜ Consistent icons, spacing, button sizes, chip colours and wording across departments
- ⬜ Keyboard-shortcut help overlay (press `?`) per screen
- ⬜ Focus rings, contrast, screen-reader labels on icon buttons
- ⬜ Browser tab title per page, favicon, no console errors

### Devices
- ⬜ Desktop (1280 to 1920) checked on each screen
- ⬜ Tablet layout for warehouse (big touch targets, no hover-only actions)
- ⬜ Phone layout for field staff (safe areas, one-hand reach, large inputs, numeric keypad)

### Print and share
- 🟡 Invoice, challan, load sheet, statement. ⬜ Consistent letterhead, page breaks, A4 and thermal 80 mm, PDF download, WhatsApp share text

### Demo mechanics
- ⬜ Realistic seed data in every list (no lorem, no empty tables)
- ⬜ "Guided demo" panel: a short script of what to click, with reset between runs
- ⬜ Demo reset that cannot break anything; clear message when data was reset
- ⬜ Full end-to-end run through all roles with no console error and no dead button

---

## B. Warehouse

### B1. Floor dashboard
- 🟡 Task tiles (to pick, trucks expected, returns, damaged). ⬜ Live task board with oldest-first ordering and SLA colours (order waiting > 2 h)
- ⬜ Shift summary: lines picked, orders packed, accuracy %, returns processed
- ⬜ Expected arrivals today with truck / dock time
- ⬜ Alerts: expiring batches, bins over capacity, negative stock, pending counts

### B2. Inbound (receiving)
- 🟡 Count against PO with damaged, batch, expiry
- ⬜ Expected deliveries list with supplier delivery note number, vehicle, driver
- ⬜ Partial receipts and over-receipt tolerance (e.g. +2% allowed, more needs approval)
- ⬜ Batch and expiry validation: expiry in the past is blocked; short shelf life (< 70% remaining) warns
- ⬜ Quality inspection result per line: accept / reject / quarantine, with reason and photo
- ⬜ Discrepancy report and claim to supplier generated automatically
- ⬜ Print GRN and putaway labels (batch, expiry, bin, barcode)
- ⬜ Barcode scan or type-ahead entry for fast counting

### B3. Locations and putaway
- ⬜ Warehouse layout: zones → aisles → racks → bins; bin master with capacity
- ⬜ Putaway suggestion (fast movers near the dock, same product together, bin capacity)
- ⬜ Confirm putaway per batch to a bin; stock stays "in receiving area" until put away
- ⬜ Bin-to-bin transfers with reason; bin label print
- ⬜ Empty-bin and over-capacity views

### B4. Stock control
- 🟡 Stock by batch with expiry. ⬜ Stock by bin and by status (available, reserved, quarantine, damaged, expired)
- ⬜ Stock ledger per product (every movement: GRN, pick, return, adjustment, transfer; who and when) with running balance
- ⬜ Batch traceability: for a batch, which customers received it (recall readiness)
- ⬜ Expiry tiers (30 / 60 / 90 days) with suggested action (push sale, discount, return to supplier)
- ⬜ Stock ageing and slow-mover report
- ⬜ Quarantine release / reject workflow

### B5. Outbound
- 🟡 Pick list sorted by rack with batch (FEFO), short-pick reason
- ⬜ Batch / wave picking by route (one picker, several orders, sort at packing)
- ⬜ Scan-to-confirm: scan bin and product; wrong batch or product is rejected
- ⬜ Packing / checking step against the challan before dispatch (checker signs off)
- ⬜ Carton count and labels per customer
- 🟡 Load sheet and dispatch. ⬜ Gate pass, vehicle capacity check, load sequence reverse of drop sequence
- ⬜ Hold and release a pick (customer on credit hold)

### B6. Returns
- 🟡 Inspect good / damaged
- ⬜ Return intake with reference to the invoice, reason, photo
- ⬜ Grading: restock, near-expiry (discount sale), damaged (supplier return), destroy
- ⬜ Destruction record with owner approval
- ⬜ Return to supplier gate pass

### B7. Inventory control
- 🟡 Blind cycle count with owner approval over a value limit
- ⬜ Count schedule by ABC class; printable count sheets; recount when variance is high
- ⬜ Adjustment reason codes (damage, theft, found, wrong receipt) with reports
- ⬜ Internal consumption / sample issue
- ⬜ Full stock take mode

### B8. Warehouse reports
- ⬜ Stock summary, movement, expiry, ageing, GRN register, dispatch register, pick accuracy, count variances, returns, damaged stock value (no prices shown to warehouse staff; quantities only)

### B9. Warehouse tools
- ⬜ Warehouse-only global search (product, batch, bin, order)
- ⬜ Tablet mode, scanner-friendly large inputs
- ⬜ Shift handover notes
- ⬜ Warehouse roles: storekeeper, picker, loader (different permissions)

---

## C. Back Office (orders, billing, accounts, masters)
- 🟡 Order approval with credit and discount rules. ⬜ Credit hold and release with reason; partial approval; split delivery; backorder handling
- ⬜ Quotation / order edit history and customer-wise special terms
- ⬜ Invoice: discount lines, tax breakdown, rounding, invoice cancellation / reversal with approval
- ⬜ Credit and debit notes as proper documents with PDFs
- 🟡 Recovery. ⬜ Promise-to-pay dates, follow-up notes, reminder list per day, cheque register (received, deposited, cleared, bounced)
- ⬜ Customer ledger export, day book, cash book, bank deposit slip
- 🟡 Trip settlement. ⬜ Cash handover slip, shortage/excess handling
- 🟡 Masters (customers, products, routes, price lists, schemes, suppliers, change log). ⬜ Booker and staff master, customer groups, GPS location

## D. Purchasing
- 🟡 Reorder planner and POs. ⬜ PO approval limits, PO edit/cancel, expected delivery date, PO print/PDF/WhatsApp
- ⬜ Supplier performance (on-time, short, damaged), price history per supplier
- ⬜ Supplier claim register and debit note tracking
- ⬜ Landed cost (freight) and cost price update on GRN

## E. Owner
- 🟡 KPIs, approvals, reports, team targets. ⬜ Date range filters, branch / depot comparison, downloadable reports, daily summary, drill-down from every number

## F. Field staff (booker, delivery, KE)
- 🟡 Route, order booking, catalog, trip, signature, collection
- ⬜ Visit outcomes (no order, shop closed, promise), visit notes, order edit before approval
- ⬜ Offline order capture and sync indicator
- ⬜ Delivery: partial delivery per line, photo proof, call customer, map link
- ⬜ KE: day-end cash summary, handover slip

## G. Production / hosting
- ⬜ Shared database, real logins, per-role permissions enforced on the server
- ⬜ Backups, error monitoring, performance budget
