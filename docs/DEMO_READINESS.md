# Demo readiness checklist

Status: ✅ done · 🟡 partly done · ⬜ not started
Built department by department. Nothing moves to the next department until the current one passes its own checklist and the universal checklist.

---

## A. Universal quality (every screen, every department)

### Loading and waiting
- ✅ Skeleton placeholders that match the layout while a screen loads (minimum ~300 ms so they never flicker)
- 🟡 Spinner inside a button while an action runs; button disabled so it cannot be double-clicked (done on the main actions: orders, picking, invoicing, dispatch, returns, GRN)
- ✅ No layout jump when data arrives (skeletons match each screen's layout)
- ⬜ Fast first paint: fonts preloaded, no flash of unstyled content, no blank white screen between pages
- ⬜ Optimistic updates (row changes at once, rolls back with a message if it fails)
- ⬜ Progress feedback for long actions (CSV import, bulk price update, print)

### Empty, error and edge states
- ✅ Empty states with a reason, and an action button where there is a next step
- ✅ Error ladder: inline field errors, toasts, offline banner, error page for unrecoverable problems
- ✅ Custom 404 and "something went wrong" pages with a way back
- ✅ Offline / connection-lost banner
- ⬜ Very long names, very large numbers, zero values, negative values, missing data: all checked on every table
- ⬜ Large data: 500+ products, 2,000+ orders stay fast (pagination or virtual lists)

### Forms
- ✅ Validate on blur, keep what the user typed after an error, specific messages (product, customer, supplier, scheme, GRN count, truck arrival)
- ✅ Required-field markers, numeric limits, duplicate-code check, unsaved-changes warning on close
- ✅ Enter submits, Esc cancels, sensible Tab order, autofocus on the first field

### Safety and feedback
- ✅ Toast after every action; ✅ Undo for hold, block/unblock, deactivate/activate
- ✅ Confirm dialog for destructive or irreversible actions, naming exactly what will happen
- ⬜ Permission feedback: a hidden or disabled button always says why on hover
- ⬜ Audit trail on every business document (who, when, what changed)

### Look and consistency
- ✅ One design system, light and dark mode. ⬜ Check every screen in dark mode
- ⬜ Same date, number and currency format everywhere; right-aligned numbers; timestamps relative with exact time on hover
- ⬜ Consistent icons, spacing, button sizes, chip colours and wording across departments
- ✅ Keyboard-shortcut help overlay (press `?`)
- ⬜ Focus rings, contrast, screen-reader labels on icon buttons
- ✅ Browser tab title per page, favicon. ⬜ Console-error sweep on every screen

### Devices
- ⬜ Desktop (1280 to 1920) checked on each screen
- ⬜ Tablet layout for warehouse (big touch targets, no hover-only actions)
- ⬜ Phone layout for field staff (safe areas, one-hand reach, large inputs, numeric keypad)

### Print and share
- 🟡 Invoice, challan, load sheet, statement, GRN, carton labels with real Code 39 barcodes. ⬜ Consistent letterhead, page breaks, A4 and thermal 80 mm, PDF download, WhatsApp share text

### Demo mechanics
- ⬜ Realistic seed data in every list (no lorem, no empty tables)
- ⬜ "Guided demo" panel: a short script of what to click, with reset between runs
- ⬜ Demo reset that cannot break anything; clear message when data was reset
- ⬜ Full end-to-end run through all roles with no console error and no dead button

---

## B. Warehouse

### B1. Floor dashboard
- 🟡 Task tiles (trucks due and late, to pick, returns, damaged / on hold). ⬜ Live task board with oldest-first ordering and SLA colours (order waiting > 2 h)
- ⬜ Shift summary: lines picked, orders packed, accuracy %, returns processed
- ✅ Expected arrivals grouped Overdue / Today / Coming
- ⬜ Alerts: expiring batches, bins over capacity, negative stock, pending counts

### B2. Inbound (receiving)
- ✅ Count against PO with rejected, damaged, held, batch, expiry
- ✅ Expected deliveries list; delivery note, vehicle and driver captured when the truck arrives
- ✅ Partial receipts (several trucks per order, close short) and over-receipt warning beyond 2%
- ✅ Batch and expiry validation: expired is blocked; under 6 months of shelf life warns
- ✅ Per-line reject / damaged / hold with reason and photo; ✅ On-hold tab with release or reject
- ✅ Claims register generated from every delivery (short, rejected, damaged, held, value at cost)
- ✅ Print GRN and carton labels (batch, expiry, rack, barcode). ⬜ Putaway labels per bin (W2)
- ✅ Typed-scan counting (code + Enter adds a carton). ⬜ Camera scanning

### B3. Locations and putaway
- ✅ Warehouse layout: zones → racks → levels → bins; bin master with capacity (add, edit, block, delete when empty). Aisles are not modelled separately
- ✅ Warehouse map with fill colours, product search highlight, and table / compact views
- ✅ Putaway suggestion (same batch, home rack floor first, same product, zone overflow; avoids mixing products)
- ✅ Confirm putaway per batch to a bin with typed bin-scan check; partial quantities; over-capacity warning; "Put all away"
- 🟡 Received stock sits at the dock until put away, but is already sellable (a picker can take from the dock). ⬜ Option to hold it unsellable until put away
- ✅ Bin-to-bin transfers with reason and capacity check; ✅ bin labels and putaway labels with barcodes
- ✅ Empty, nearly full, over-capacity and blocked views
- ✅ Pick-face replenishment suggestions (floor bin nearly empty while stock is stored higher up)
- ✅ Pick list and challan show the bin to take from

### B4. Stock control
- ✅ Stock by batch with expiry and bin; ✅ by status (available, reserved, quality hold, damaged, expired); by bin is the Locations screen
- ✅ Movement ledger per product or for everything: receipts, picks, returns, adjustments, moves, holds, supplier returns, write-offs, with running balance, filters, search and CSV export
- ✅ Batch traceability: choose a batch, see where it came from, where it is, and every customer who received it; ✅ recall: hold the remaining stock and print a customer call list
- ✅ Expiry tiers (expired / 30 / 60 / 90 days) with suggested action; ✅ run a short-expiry deal (bookers see a tag), return to supplier, or write off
- ✅ Expired stock is never sellable, never counted as available, and never picked
- ✅ Ageing by days since received and slow-mover flags (nothing picked for 3 weeks, or over 60 days of cover)
- ✅ Quarantine release / reject (from W1)
- ⬜ Write-off approval by the owner above a value limit (write-offs currently need only a confirm)

### B5. Outbound
- ✅ Pick list sorted by rack with bin and batch (FEFO, expired never picked), short-pick reason
- ✅ Wave picking: tick orders or "Pick whole route", one consolidated pick list, each order still gets its own challan
- ✅ Scan-to-confirm per stop: bin first, then carton label (product and batch); wrong bin, product or batch is rejected. "Confirm without scan" is recorded as manual. Typed entry only (no camera)
- ✅ Packing check against the challan: count each line (scan adds one), sign-off, four-eyes warning when the picker also checks. Invoicing is blocked until packing is signed off
- ✅ Carton / bag count per customer and customer carton labels (wave orders are tagged for sorting)
- ✅ Load sheet in reverse drop order, drop-order editor with auto-sort, vehicle capacity check, gate pass with seal number
- ✅ Hold and release a pick (back office), also automatic when the customer is blocked
- ⬜ Substitute batch when the FEFO batch is damaged or missing (picker can only short-pick today)

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
