# Zarie Distributors · Distribution Management System (demo)

Interactive demo of a connected distribution workflow: purchasing → warehouse → bookers → sales desk → challan → invoice → delivery → recovery, with returns and credit control.

Next.js (App Router) · TypeScript · Tailwind. Demo data is seeded and kept in the browser (localStorage); there is no backend yet. Use "Reset demo data" in the sidebar to start over.

## Roles (login screen)
- **Owner / Admin** – everything, master data (customers, products)
- **Sales Desk** – approve orders, invoice, post recovery
- **Warehouse** – receive stock, pick, challans
- **Purchasing** – factory POs, approve goods received
- **Booker / Delivery / Recovery (KE)** – mobile app at `/m`

## Keyboard
`Ctrl+K` command palette · `J/K` move · `N` new order · `/` filter · `Enter` primary action

## Run
```bash
npm install
npm run dev
```
