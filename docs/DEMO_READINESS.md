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
- ✅ Return intake at the dock: count what actually arrived (more than reported is blocked, fewer is flagged and credited for the received quantity), photo, condition note, invoice reference shown
- ✅ Grading: back to stock (into the original batch), back to stock as a short-expiry deal, to the supplier pile, or destroy; suggestion from the reason and the batch's shelf life; credit note can be switched off when the customer is at fault
- ✅ Destruction record: owner approval, then witnessed record with method, then printable certificate. If the owner rejects, the goods go back to the damaged pile. Damaged stock can also be put forward for destruction
- ✅ Return to supplier: printable debit note and gate pass with vehicle and driver

### B7. Inventory control
- ✅ Count sessions per bin and batch, blind (system quantity hidden), submit, then review with variances revealed
- ✅ Recount required when a variance is worth over Rs. 5,000 or over 10% of the system quantity; every difference needs a reason code before posting
- ✅ ABC count schedule (A weekly, B monthly, C quarterly) with overdue and due flags; start a count from the schedule or from a product on the Stock page; printable blind count sheets
- ✅ Full stock take mode with zone filter
- ✅ Adjustment reason codes (miscount, damage, theft or loss, found stock, wrong receipt or picking error, unit error) with an adjustments report by reason; differences over Rs. 20,000 go to the owner
- ✅ Internal consumption: issue stock as a sample, internal use or marketing display; large issues need owner approval
- ⬜ Second counter must be a different person (the system does not track who recounted)

### B8. Warehouse reports
- ✅ Eight reports with 7 / 30 / 90 day filters and CSV export: stock summary, movements, goods received (GRN register), dispatch register, pick accuracy by person, count accuracy, returns, damaged and held stock
- ✅ Warehouse staff see quantities only. Cost values appear for Purchasing and the Owner

### B9. Warehouse tools
- ✅ Warehouse-scoped search (Ctrl+K): products, batches, bins, GRNs, challans and orders. Customers and prices are not shown to warehouse staff
- ✅ Touch mode: bigger buttons and inputs for tablets, switched on automatically on touch screens, remembered per device
- ✅ Shift handover notes with "important" flag, one-click "add today's numbers", and read receipts per person
- ✅ Warehouse roles: Storekeeper (everything), Picker (pick and pack), Loader (dispatch). Other screens are view-only with a banner saying so; each role lands on its own home screen
- ⬜ Camera barcode scanning (typed codes only)

## C. Back Office (orders, billing, accounts, masters)
- ✅ Order approval with credit and discount rules (per-customer discount limit); ✅ credit hold and release with a reason, history kept on the statement; ✅ partial approval ("approve what's available") with an automatic backorder; ✅ short picks create a backorder; ✅ Backorders tab. ⬜ Split delivery over several trips
- ✅ Order edit history, order trail and customer-wise special terms (banner on the order)
- ✅ Invoice: tax breakdown, rounding, amount in words, payment terms; ✅ invoice cancellation needs owner approval, then re-invoice with an -R suffix. ⬜ Per-line discount column
- ✅ Credit and debit notes as printable documents (owner approval above Rs. 25,000); graded returns appear as credit notes. ⬜ PDF download
- ✅ Recovery: promise-to-pay dates (missed promises flagged), follow-up notes, "Call today" list; ✅ cheque register (received, deposited, cleared, bounced; a bounce puts the amount back on the customer) with printable bank deposit slip
- ✅ Customer ledger CSV export, day book, cash book (all with CSV)
- ✅ Trip settlement: reason and responsible person required for any cash difference, printable cash handover slip
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
