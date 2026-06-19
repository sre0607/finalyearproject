# Florish - Premium Floral E-Commerce Website 🌸🌱

Florish is a complete, decoupled full-stack Floral E-Commerce web application. It is designed with clean scalable architecture, specifically tailored as a comprehensive final year academic project (e.g. BCA/B.Sc. CS/MCA).

The system decouples a static frontend (HTML5, HSL-based CSS3 tokens, dynamic modular Javascript) from a Node.js + Express.js REST API backend connected to a MongoDB database, incorporating secure JWT authentication and Multer-based image file uploads.

---

## 📂 Project Structure

```text
d:/finalProject/ (Root Workspace)
│
├── package.json                 # Unified workspace command definitions
├── .env.example                 # Root-level configuration blueprint
├── .gitignore                   # Workspace Git ignore configurations
│
├── fe/                          # Main Project Folder
│   ├── database/                # Database schema details and static seed files
│   │   ├── mongodb-schema.txt   # Collection parameters and indexing details
│   │   └── sample-data.json     # Sample products and test credentials
│   │
│   ├── documentation/           # Academic SRS documents, DFD, ER-Diagrams
│   │   ├── DFD.png
│   │   ├── ER-Diagram.png
│   │   └── SRS.docx
│   │
│   ├── backend/                 # Node.js + Express.js REST API Server
│   │   ├── server.js            # Main Express server initialization entrypoint
│   │   ├── seeder.js            # Database seeder (Import/Destroy collections)
│   │   ├── config/              # MongoDB and Cloudinary config details
│   │   ├── controllers/         # MVC Controllers handling business logic
│   │   ├── middleware/          # JWT check filters, upload gates, error handlers
│   │   ├── models/              # Mongoose collection schemas
│   │   ├── routes/              # Express endpoint mappings
│   │   ├── uploads/             # Local directory holding Multer uploaded graphics
│   │   ├── utils/               # JWT signers and validator helpers
│   │   └── package.json         # Backend dependencies and run commands
│   │
│   └── frontend/                # Static Website Client assets
│       ├── index.html           # Homepage layout with hero slideshow
│       ├── shop.html            # Product catalog search & filtering
│       ├── product-details.html # Dynamic specifications loader & reviews poster
│       ├── cart.html            # Persistent shopping cart tables
│       ├── checkout.html        # Billing forms and order checkpoint dispatcher
│       ├── wishlist.html        # Saved favorite products grid
│       ├── orders.html          # Order tracking and invoice views
│       ├── css/                 # HSL styling sheets (style.css, darkmode.css)
│       ├── js/                  # Centralized fetch API client (api.js, auth.js)
│       └── admin/               # Backoffice panels (dashboard.html, add-product.html)
```

---

## 🚀 Setup & Setup Directions

### Prerequisites
- Install **Node.js** (Version 16+).
- Install and launch **MongoDB Community Server** locally on port 27017, or set up a cloud database cluster on **MongoDB Atlas**.

---

### Step 1: Configuration SETUP

1. Inside the root folder, create a copy of `.env.example` inside the `fe/backend/` directory:
   ```bash
   cp .env.example fe/backend/.env
   ```
2. Open `fe/backend/.env` and replace placeholders with your actual parameters:
   ```ini
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/florish
   JWT_SECRET=myVeryStrongSecretKey123
   JWT_EXPIRE=30d
   ```

---

### Step 2: Database Initialization (Automatic Seeding)

We have built an automated seeding command to clear prior records and import default categories, products, and users (admin and standard customer) into your database:

From the **project root directory**, run:
```bash
npm run db:import
```
*Note: To wipe the collections at any time, run `npm run db:destroy`.*

---

### Step 3: Run the Backend REST API Server

Install dependencies and start the Express server using Nodemon (which automatically restarts upon code changes):

From the **project root directory**, run:
```bash
# Install root workspace dependencies
npm install

# Run backend in development mode
npm run dev
```

You should see these console logs:
- `MongoDB Connected successfully: 127.0.0.1`
- `Florish Backend Server successfully listening in development mode on port 5000`

---

### Step 4: Run the Frontend Website

You can run the frontend by launching it with a server or opening the files directly:
1. Open the file `fe/frontend/index.html` directly in your browser.
2. For the best experience, run it using a local server extension (e.g. VS Code Live Server).
3. The frontend `js/api.js` script automatically resolves your environment:
   - When hosted on **localhost** (127.0.0.1), it redirects requests to the local Express API at `http://localhost:5000/api`.
   - When deployed to production, it redirects requests to your Render Web Service.

---

## 🔑 Test Credentials & Mock Accounts

After running the database seeder, you can log in with these pre-configured profiles:

1. **Administrator Profile:**
   - **Email:** `admin@florish.com`
   - **Password:** `admin123`
   - **Access Level:** Backoffice inventory dashboard, users directory, and orders update controls.

2. **Standard Customer Profile:**
   - **Email:** `jane@gmail.com`
   - **Password:** `user123`
   - **Access Level:** Catalog browsing, persistent cart checkouts, and personal order tracking.

---

## 🌐 Production Deployment Steps

### 1. Database (MongoDB Atlas)
- Log in to MongoDB Atlas and create a Free Shared Cluster.
- Go to Database Access and add a user with read/write permissions.
- In Network Access, whitelist IP `0.0.0.0/0` to allow connections from Render.
- Copy your MongoDB Connection String URI (replacing password placeholders).

### 2. Backend (Render)
- Connect your GitHub repository to Render.
- Create a new **Web Service**, set the Root Directory to `fe/backend`, and Build Command to `npm install`.
- Set the Start Command to `node server.js`.
- Add these Environment Variables under Settings:
  - `MONGO_URI` = *[Your MongoDB Atlas Connection String]*
  - `JWT_SECRET` = *[Your Long Random Secret Key]*
  - `NODE_ENV` = `production`
  - `FRONTEND_URL` = *[Your Frontend Netlify Site URL]*
- Once deployed, copy your Render API URL (e.g. `https://florish-api.onrender.com`).

### 3. Frontend (Netlify)
- Log in to Netlify and create a site from your GitHub repository.
- Set the base directory to `fe/frontend`.
- Once deployed, open the browser Console or settings. If needed, configure the backend API endpoint by setting `florish_api_url` inside `localStorage`:
  ```javascript
  localStorage.setItem('florish_api_url', 'https://florish-api.onrender.com/api');
  ```

---

## 🎓 BCA Academic Project Features Satisfaction
Florish meets the rigorous evaluation rubrics for final year capstone requirements:
- **Systems Analysis Documentation:** Software Requirements Specification (SRS), ER model relational schemas, multi-level DFD, Data Dictionary matrices, and Process Logic templates are pre-packaged in the `documentation/` and `database/` folders.
- **Decoupled Architecture:** Clean segregation of client HTML views and backend REST controllers ensures strict adherence to clean programming paradigms.
- **Relational Integrity Constraints:** Database Schemas enforce unique SKUs, strict enum product categories, positive price bounds, and single compound reviews per customer.
- **Security:** Complete encryption of authentication parameters using Bcrypt.
- **Dynamic Extensibility:** Modular dynamic loading architecture on both the client (reusable template injection via vanilla JavaScript) and the server (modular routing structures with custom database middleware).
