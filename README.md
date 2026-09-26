# INE Price Tracker

A full-stack product price and stock tracking application developed for the INE Software Engineer Intern Assignment.

The application allows users to search products from the INE mock store, select a specific product option, track products, scrape price and stock information, maintain historical data and scrape logs, and export collected data as CSV.

## Live Project

### Frontend
https://YOUR-VERCEL-URL

### Backend
https://my-ine-project-oeh8.onrender.com

### Mock Store
https://demo.inelabteamdev.com

---

## Features

- Search products by partial or full product name
- Select a specific product option or bundle
- Track multiple products
- Scrape current price
- Scrape current stock availability
- Playwright-based browser scraping
- Cookie consent handling
- Automatic retry mechanism
- Timeout handling
- HTTP error handling
- Price history tracking
- Stock history tracking
- Complete scrape attempt logs
- Manual "Scrape Now" functionality
- Scheduled scraping
- CSV export
- Supabase PostgreSQL persistence
- React frontend
- Node.js and Express backend
- Vercel frontend deployment
- Render backend deployment
- External cron scheduling

---

## Tech Stack

### Frontend

- React.js
- Vite
- Axios
- CSS

### Backend

- Node.js
- Express.js
- Playwright
- Cheerio

### Database

- Supabase PostgreSQL

### Deployment

- Vercel
- Render

### Scheduling

- cron-job.org

---

## Project Structure

INE-project_By_Usmaan/

    backend/
        src/
            config/
                supabase.js

            controllers/
                productController.js
                exportController.js
                cronController.js
                catalogController.js

            routes/
                productRoutes.js
                exportRoutes.js
                cronRoutes.js
                catalogRoutes.js

            scraper/
                scraper.js
                cookieHandler.js

            services/
                scrapeService.js
                testScrapeService.js

            app.js
            server.js

        .env
        .gitignore
        package.json

    frontend/
        src/
            components/
                HistoryChart.jsx
                ScrapeLogs.jsx

            App.jsx
            App.css
            main.jsx

        package.json

---

## System Architecture

React Frontend
        |
        | REST API
        v
Node.js + Express Backend
        |
        +-------------------+
        |                   |
        v                   v
Supabase PostgreSQL     Playwright Scraper
                            |
                            v
                    INE Mock Store

External Cron
        |
        v
POST /api/cron/scrape
        |
        v
Backend
        |
        v
All Tracked Products
        |
        v
Scrape -> Retry -> Save History

---

## Application Flow

### Product Search

User enters a product name in the Add Product section.

Search request:

GET /api/catalog/search?q=digital%20piano

The backend searches the INE mock store catalog and returns matching products.

The frontend uses a short debounce before sending search requests so that unnecessary requests are avoided while typing.

---

### Product Selection

After searching, the user selects a product.

The application then fetches the available options for that product.

GET /api/catalog/:id/options

The user selects the required option or bundle.

---

### Product Tracking

After selecting the product and option, the application sends the product information to the backend.

POST /api/products

The selected product and option are stored in the tracked_products table.

---

## Scraping Process

The scraper uses Playwright because the mock store contains dynamically rendered offer information and requires browser interaction.

The scraping process is:

1. Open product page
2. Handle cookie consent popup
3. Select the required product option
4. Find the offer panel
5. Perform unlock hover
6. Unlock the price button
7. Click the "Check today's price" button
8. Wait for the quote API response
9. Wait for the rendered offer information
10. Extract price
11. Extract stock
12. Save the result in the database

---

## Price Extraction

The scraper extracts price values from the rendered offer panel.

The application handles dynamically rendered price information and normalizes the extracted text before processing the numeric price values.

---

## Stock Extraction

The scraper supports different stock formats returned by the mock store.

Examples include:

- AVAILABLE
- 127 AVAILABLE
- 14 AVAILABLE
- LAST FEW: 36
- ONLY 5 LEFT
- 5 LEFT
- SOLD OUT
- OUT OF STOCK

The extracted stock information is stored in scrape_history.

---

## Retry and Failure Handling

Every scrape can run for a maximum of 3 attempts.

Flow:

Attempt 1
    |
    +-- Success -> Save success
    |
    +-- Failure -> Save retry log
                       |
                       v
                   Attempt 2
                       |
                       +-- Success -> Save retried
                       |
                       +-- Failure -> Save retry log
                                          |
                                          v
                                      Attempt 3
                                          |
                                          +-- Success -> Save retried
                                          |
                                          +-- Failure -> Save failed

The scraper does not silently stop after a failure.

Failed attempts store:

- No price
- No stock
- Error message
- Attempt number
- Timestamp
- Failure/retry outcome

---

## Error Handling

The application handles different scraper failure scenarios.

### Quote API Timeout

If the quote API does not respond within the configured timeout, the current attempt is recorded and the scraper retries.

### HTTP 500

If the quote API returns HTTP 500, the failure is logged and the scraper retries.

### Cookie Popup

The scraper detects the cookie consent popup and attempts to click the ALLOW button.

### Locked Price Button

The scraper performs bounded hover and recovery movements to unlock the price button.

### Scrape Failure

After all retry attempts fail, the final attempt is saved with the failed outcome and error message.

---

## Database Design

The application uses Supabase PostgreSQL.

### tracked_products

This table stores products selected by the user for tracking.

Fields:

- id
- store_product_id
- product_name
- selected_option
- product_url
- created_at

The combination of store_product_id and selected_option is unique.

---

### scrape_history

This table stores every scraping attempt.

Fields:

- id
- tracked_product_id
- attempt_number
- scraped_at
- price
- stock
- outcome
- error_message

Possible outcome values:

- success
- retried
- failed

Failed attempts have blank/null price and stock values.

---

## Dashboard

The dashboard displays tracked products and their monitoring information.

For each product, the application displays:

- Product name
- Store product ID
- Selected option
- Current price
- Current stock
- Last successful scrape
- Price history
- Scrape activity
- Number of scrape attempts

---

## Manual Scraping

Each tracked product has a "Scrape Now" button.

The frontend sends:

POST /api/products/:id/scrape

The backend runs the scrape service.

The scrape service:

1. Attempts scraping
2. Retries when required
3. Saves every attempt
4. Returns the final result
5. Updates the product history

---

## Scheduled Scraping

Scheduled scraping is triggered using an external cron service.

Endpoint:

POST /api/cron/scrape

The cron request requires the following header:

x-cron-secret: YOUR_CRON_SECRET

The scheduled process:

1. Fetch all tracked products
2. Scrape each tracked product
3. Retry failed attempts
4. Save successful results
5. Save retry attempts
6. Save final failures
7. Continue with the remaining tracked products

The production schedule is configured to run every 2 hours.

An external cron service is used because the backend is deployed on a free-tier hosting environment that can sleep when inactive.

---

## CSV Export

The application provides CSV export for tracked products.

The exported data contains:

- Store product ID
- Product name
- Selected option
- Timestamp
- Price
- Stock
- Outcome

Failed attempts contain blank price and stock values while retaining the timestamp and outcome.

---

## API Endpoints

### Health Check

GET /api/health

Checks whether the backend is running.

---

### Database Test

GET /api/test-db

Checks Supabase database connectivity.

---

### Get Tracked Products

GET /api/products

Returns all tracked products.

---

### Get Single Product

GET /api/products/:id

Returns a specific tracked product.

---

### Add Product

POST /api/products

Adds a product and selected option to tracking.

Example request:

{
    "store_product_id": "2638",
    "product_name": "Junova Travel Router Nano",
    "selected_option": "2-pack",
    "product_url": "https://demo.inelabteamdev.com/item/2638"
}

---

### Price History

GET /api/products/:id/history

Returns price and stock history for a tracked product.

---

### Latest Price

GET /api/products/:id/latest

Returns the latest successful scrape.

---

### Scrape Logs

GET /api/products/:id/logs

Returns all scraping attempts for a tracked product.

---

### Manual Scrape

POST /api/products/:id/scrape

Starts a manual scrape for the selected tracked product.

---

### Product Search

GET /api/catalog/search?q=digital%20piano

Searches the INE mock store catalog.

---

### Product Options

GET /api/catalog/:id/options

Returns available options for a product.

---

### Scheduled Scrape

POST /api/cron/scrape

Starts scheduled scraping for all tracked products.

The endpoint is protected using the cron secret.

---

## Environment Variables

### Backend

Create a .env file inside the backend directory.

Required variables:

SUPABASE_URL=your_supabase_url

SUPABASE_SECRET_KEY=your_supabase_secret_key

PORT=5000

CRON_SECRET=your_cron_secret

For Render:

SUPABASE_URL=your_supabase_url

SUPABASE_SECRET_KEY=your_supabase_secret_key

CRON_SECRET=your_cron_secret

PLAYWRIGHT_BROWSERS_PATH=0

HEADLESS=true

---

### Frontend

For local development:

VITE_API_URL=http://localhost:5000/api

For production:

VITE_API_URL=https://my-ine-project-oeh8.onrender.com/api

Never commit .env files or secret keys to GitHub.

---

## Local Setup

### Backend

Open a terminal and run:

cd backend

npm install

npx playwright install chromium

npm start

The backend runs on:

http://localhost:5000

---

### Frontend

Open another terminal:

cd frontend

npm install

npm run dev

The frontend will start using the Vite development server.

---

## Deployment

### Backend Deployment

The backend is deployed on Render.

Root Directory:

backend

Build Command:

npm install && npx playwright install chromium

Start Command:

npm start

Render environment variables:

- SUPABASE_URL
- SUPABASE_SECRET_KEY
- CRON_SECRET
- PLAYWRIGHT_BROWSERS_PATH
- HEADLESS

---

### Frontend Deployment

The frontend is deployed on Vercel.

Production environment variable:

VITE_API_URL=https://my-ine-project-oeh8.onrender.com/api

---

## Cron Configuration

The external cron service sends:

POST

https://my-ine-project-oeh8.onrender.com/api/cron/scrape

Required header:

x-cron-secret: YOUR_CRON_SECRET

Final production frequency:

Every 2 hours

---

## Testing

The application has been tested for:

- Product search
- Product option selection
- Product tracking
- Manual scraping
- Scheduled scraping
- Price extraction
- Stock extraction
- Cookie popup handling
- Price button unlocking
- Quote API timeout
- HTTP 500 response
- Automatic retry
- Failed scrape logging
- Successful scrape logging
- Price history
- Scrape activity logs
- CSV export
- Supabase persistence

---

## Tracked Products

The application has been tested with multiple products from the INE mock store.

Examples:

1. Junova Travel Router Nano
   - Option: 2-pack

2. Mosella Digital Piano Core
   - Option: Starter bundle

3. Pinecrest Digital Piano Aero
   - Option: Starter bundle

---

## Security

Sensitive credentials are stored using environment variables.

The following must not be committed to GitHub:

- .env
- SUPABASE_SECRET_KEY
- CRON_SECRET

The scheduled scraping endpoint requires the configured cron secret.

Supabase Row Level Security is enabled for the application tables.

---

## Known Limitations

- The scraper is designed specifically for the provided INE mock store.
- Scraping depends on the mock store page structure.
- Render free-tier instances may sleep when inactive.
- External cron is therefore used for scheduled scraping.
- The scraper currently uses a maximum of 3 attempts per scrape.

---

## Future Improvements

- Price drop alerts
- Email notifications
- Configurable scraping frequency
- Price change detection
- Multiple store support
- Additional analytics
- User authentication
- CI/CD automation

---

## Author

Usmaan Mohd

Developed for the INE Software Engineer Intern Assignment.