## Product Price Tracker

A full-stack product price and stock tracking application built for the INE Software Engineer Intern assignment.

The application allows users to search products from INE's hosted mock store, select a product option, track it, scrape its price and stock on a fixed schedule, view history/logs, and export scrape history as CSV.

---

## Live Project

- **Frontend:** https://my-ine-project.vercel.app/
- **Backend:** AWS EC2 (final deployment)
- **Initial Backend Deployment:** Render
- **Database:** Supabase PostgreSQL
- **Repository:** https://github.com/UsmaanMohd/my-INE-project

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js, Vite, Vercel |
| **Backend** | Node.js, Express.js |
| **Scraping** | Playwright |
| **Database** | Supabase PostgreSQL |
| **Scheduling** | cron-job.org |
| **DevOps** | Docker, Jenkins, Amazon ECR, AWS EC2 |
| **Version Control** | Git, GitHub |

---

## Deployment

### ✅ Successful Initial Deployment — Vercel + Render

The complete application was first deployed and tested using the assignment's recommended deployment setup.

```
React Frontend
      ↓
   Vercel
      ↓
Node.js + Express + Playwright
      ↓
   Render
      ↓
Supabase PostgreSQL


cron-job.org
      ↓
Render Backend
```

The application was successfully tested on this setup before moving the backend to AWS.

**Verified on Render + Vercel:**
- Product search
- Product and option selection
- Tracking products
- Playwright scraping
- Price and stock extraction
- Supabase database operations
- Price history
- Scrape logs
- Retry and failure handling
- CSV export
- Scheduled scraping through cron-job.org

### 🚀 Final Deployment — Vercel + AWS CI/CD

After the Render + Vercel deployment was working successfully, the backend was moved to AWS EC2 for the final deployment. The frontend continued to run on Vercel.

```
React Frontend
      ↓
   Vercel
      ↓
  AWS EC2
      ↓
Docker Container
      ↓
Node.js + Express + Playwright
      ↓
Supabase PostgreSQL
```

**AWS CI/CD Flow:**

```
GitHub
   ↓
Jenkins
   ↓
Docker Build
   ↓
Amazon ECR
   ↓
AWS EC2
   ↓
Health Check
   ↓
Deployment Complete
```

Jenkins handles the Docker build, ECR image push, EC2 deployment, container replacement, and post-deployment health check.

---

## Core Features

### 1. Product Search and Selection

Users can search the INE hosted mock store using a partial or full product name.

```
User enters product name
        ↓
   React Frontend
        ↓
  Backend Catalog API
        ↓
   INE Mock Store
        ↓
  Matching Products
        ↓
User selects Product + Option
        ↓
Tracked Product saved in Supabase
```

The selected product option is persisted so future scrapes track the same option.

### 2. Product Tracking

A tracked product stores:

- Store product ID
- Product name
- Selected option
- Product URL
- Created timestamp

At submission, multiple products are tracked so the dashboard contains real history and scrape logs.

### 3. Price and Stock Scraping

Playwright is used because the mock store requires browser interaction and dynamically rendered data.

**Scraping Flow:**

```
Tracked Product
      ↓
Open Product Page
      ↓
Handle Cookie Consent
      ↓
Select Required Option
      ↓
Unlock Offer
      ↓
Hover / Page Interaction
      ↓
Wait for Price Button
      ↓
Click Price Button
      ↓
Wait for Quote API
      ↓
Wait for Offer Rendering
      ↓
Extract Price + Stock
      ↓
Save Result
```

The scraper is designed specifically for the provided INE mock store.

### 4. Reliability and Retry Handling

Scraping is attempted up to 3 times.

```
Attempt 1
   ↓
 Success → success
   │
   └── Failure
          ↓
      Save retry log
          ↓
      Attempt 2
          ↓
      Success → retried
          │
          └── Failure
                 ↓
             Attempt 3
                 ↓
        Success → retried
                 │
                 └── Failure → failed
```

The scraper handles:

- Slow responses
- Quote API delays
- Price button delays
- Temporary scraping failures
- Page interaction issues
- Retry and recovery

**Failures are not silently ignored.** For a failed attempt:

```
price          = blank
stock          = blank
outcome        = failed
error_message  = stored
```

This keeps the scrape history honest.

### 5. Scheduled Scraping — Every 2 Hours

The assignment requires scheduled scraping every 2 hours. We use **cron-job.org** as the external scheduler.

**Initial Render Setup:**

```
cron-job.org
      ↓
Render Backend
      ↓
POST /api/cron/scrape
      ↓
Fetch All Tracked Products
      ↓
Scrape Products
      ↓
Save History
```

**Final AWS Setup:**

After moving the backend to AWS, cron-job.org was updated to trigger the AWS backend.

```
cron-job.org
      ↓
AWS EC2 Backend
      ↓
POST /api/cron/scrape
      ↓
Fetch All Tracked Products
      ↓
Playwright Scraping
      ↓
Retry Failed Attempts
      ↓
Save Price + Stock + Outcome
      ↓
Supabase PostgreSQL
```

The scheduled AWS run was verified with multiple products, including successful first attempts and successful retry/recovery cases.

### 6. Price History

Each successful or recovered scrape is stored in `scrape_history`. The dashboard can show the tracked product's price and stock history over time.

```
Scrape
   ↓
Price + Stock
   ↓
Timestamp
   ↓
Supabase
   ↓
History
```

### 7. Per-Product Scrape Log

Every scrape attempt is recorded with:

- Attempt number
- Timestamp
- Price
- Stock
- Outcome
- Error message when applicable

**Possible outcomes:** `success`, `retried`, `failed`

Failures remain visible instead of being hidden.

### 8. CSV Export

The dashboard provides CSV export for the complete scrape history.

**The CSV contains:**

- store product ID
- product name
- selected option
- timestamp (ISO 8601 UTC)
- price
- stock
- outcome

Failed attempts are included with blank price and stock values.

### 9. Headed Scraper Run

The scraper can run using a visible Playwright browser so its behavior can be observed.

**The headed flow demonstrates:**

```
Open Mock Store
      ↓
Handle Cookies
      ↓
Select Option
      ↓
Unlock Offer
      ↓
Price Request
      ↓
Slow / Failed Response
      ↓
Retry
      ↓
Successful Scrape
      ↓
Save History
```

This is used for the required 2–4 minute screen recording.

---

## Database

Two main Supabase PostgreSQL tables are used.

### `tracked_products`

Stores the products and options being tracked.

- `id`
- `store_product_id`
- `product_name`
- `selected_option`
- `product_url`
- `created_at`

### `scrape_history`

Stores every scrape attempt.

- `id`
- `tracked_product_id`
- `attempt_number`
- `scraped_at`
- `price`
- `stock`
- `outcome`
- `error_message`

---

## ⭐ Bonus Features Implemented

### ⭐ Bonus 1 Implemented — Multiple Tracked Products Dashboard

The assignment lists a dashboard across multiple tracked products as a bonus. The application tracks multiple products simultaneously and stores separate history/logs for each product.

```
Product 1 → History + Logs
Product 2 → History + Logs
Product 3 → History + Logs
Product 4 → History + Logs
```

This demonstrates that scheduled scraping processes all tracked products rather than only one product.

### ⭐ Bonus 2 Implemented — CI/CD with Jenkins

The assignment mentions CI/CD as a bonus. Instead of GitHub Actions, the project implements CI/CD using **Jenkins + Docker + Amazon ECR + AWS EC2**.

```
GitHub
   ↓
Jenkins
   ↓
Docker Build
   ↓
Amazon ECR
   ↓
AWS EC2
   ↓
Health Check
```

**The pipeline:**

1. Checks out the GitHub repository.
2. Builds the backend Docker image.
3. Logs into Amazon ECR.
4. Pushes the latest image to ECR.
5. Pulls the latest image on EC2.
6. Stops and removes the previous container.
7. Starts the new container.
8. Performs a backend health check.

---

## Architecture

```
                         ┌───────────────┐
                         │    Vercel     │
                         │ React Frontend│
                         └───────┬───────┘
                                 │
                                 ↓
                         ┌───────────────┐
                         │    AWS EC2    │
                         │    Docker     │
                         │  Node/Express │
                         │   Playwright  │
                         └───────┬───────┘
                                 │
                                 ↓
                         ┌───────────────┐
                         │   Supabase    │
                         │  PostgreSQL   │
                         └───────────────┘

GitHub → Jenkins → Docker → Amazon ECR → AWS EC2

cron-job.org
      ↓
AWS EC2 /api/cron/scrape
      ↓
Scheduled scraping every 2 hours
```

---

## Complete Application Flow

```
User
 ↓
Search Product
 ↓
Select Product + Option
 ↓
Track Product
 ↓
Supabase
 ↓
Manual Scrape / Scheduled Scrape
 ↓
Playwright
 ↓
Price + Stock Extraction
 ↓
Retry if required
 ↓
Save Scrape History
 ↓
Dashboard History / Logs
 ↓
CSV Export
```

---

## Local Setup

```bash
git clone https://github.com/UsmaanMohd/my-INE-project.git
cd my-INE-project/backend
npm install
npm start
```

Backend starts on port `5000`.

---

## Important API Endpoints

```
GET  /api/health
GET  /api/test-db

GET  /api/catalog/search
GET  /api/products

POST /api/products
POST /api/products/:id/scrape

GET  /api/products/:id/history
GET  /api/products/export/csv

POST /api/cron/scrape
```

---

## Security

- Database secret credentials are kept outside the public source code.
- Cron endpoint is protected with a secret request header.
- Sensitive credentials are not included in the public GitHub repository.
- AWS access is handled through the EC2 IAM role rather than hard-coded AWS credentials.

---

## AI Tool Usage

AI tools were used during development for assistance with:

- Debugging
- Understanding Playwright behavior
- Improving retry/error-handling logic
- Deployment troubleshooting
- README/documentation preparation

All final code was reviewed, tested, and adapted during the implementation. The scraping logic was tested against the provided INE mock store, including delayed responses and retry scenarios.

---

## Project Structure

```
INE-project_By_Usmaan/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── scraper/
│   │   ├── services/
│   │   ├── app.js
│   │   └── server.js
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── frontend/
├── Jenkinsfile
└── README.md
```

---

## Final Deployment Summary

### Initial Successful Deployment

**Vercel + Render + Supabase + cron-job.org**

The application was first deployed and fully tested using the assignment's recommended deployment architecture.

### Final Deployment

**Vercel + AWS EC2 + Docker + Jenkins + Amazon ECR + Supabase + cron-job.org**

After successful Render testing, the backend was moved to AWS and the CI/CD pipeline was added.

---

## Bonus Highlights

- ⭐ Multiple tracked products
- ⭐ Jenkins CI/CD
- ⭐ Docker containerization
- ⭐ Amazon ECR
- ⭐ AWS EC2 deployment