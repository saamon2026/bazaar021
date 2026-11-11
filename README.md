# Bazaar 021

New and pre-owned streetwear store for the GTA. Static storefront (`public/index.html`) plus two Vercel functions.

- `POST /api/submit` saves an order, draw entry, bid, or sell/trade submission as a private JSON file in Vercel Blob (`subs/<type>/...`).
- `GET /api/bids` is public: top bid, bid count and closing time per auction lot (no names or emails). Bids are checked on the server, so every bidder sees the same numbers.
- `GET /api/inbox` lists every submission; `PATCH /api/inbox` updates a status. Both need the `x-owner-key` header.
- Owner inbox: open `/#owner` and enter the passcode.

## Environment variables (Vercel project)
- `BLOB_READ_WRITE_TOKEN`: added automatically when the Blob store is connected.
- `OWNER_KEY`: owner passcode, at least 12 characters.

## Still sample data
The 21 products, lots, and draw shoe in `public/index.html` are samples. Replace them with real stock before Drop 001.

## Keep in step
- Auction lots live in two places: `LOTS` in `public/index.html` (what people see) and `LOTS` in `api/_auction.js` (opening bid and close offset the server enforces). Change both together.
- Contact details: fill `CONTACT = {ig, email}` in `public/index.html`; the footer Contact sheet, Privacy page and error messages pick them up.
- Product photos are files in `public/img/`. `og.jpg` is the link-preview image for Instagram, WhatsApp and iMessage.
