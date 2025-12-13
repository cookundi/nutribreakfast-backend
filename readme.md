# 🚀 NutriBreakfast Backend - Complete Setup Guide

This guide will walk you through setting up the Node.js backend from scratch, even if you've never used Node.js before.

---

## 📋 What We've Built

A complete backend API with:
- ✅ User Authentication (JWT)
- ✅ Health Profile Management
- ✅ AI-Powered Meal Recommendations (Claude)
- ✅ Order Management System
- ✅ Payment Integration (Paystack)
- ✅ Company Dashboard & Analytics
- ✅ Automated Tasks (Cron Jobs)
- ✅ Email Notifications
- ✅ Invoice Generation

---

## 📋 Prerequisites Installation

### Step 1: Install Node.js & npm

**For Windows:**
1. Go to https://nodejs.org/
2. Download the **LTS version** (Long Term Support) - currently 20.x
3. Run the installer (.msi file)
4. Keep clicking "Next" with default settings
5. Verify installation by opening **Command Prompt** (Win + R, type `cmd`) and run:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers like `v20.x.x` and `10.x.x`

**For Mac:**
1. Install Homebrew first (if not installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install Node.js:
   ```bash
   brew install node
   ```
3. Verify:
   ```bash
   node --version
   npm --version
   ```

**For Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

---

### Step 2: Install PostgreSQL Database

**For Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer
3. **IMPORTANT:** Remember the password you set for the `postgres` user!
4. Default port: 5432 (keep it)
5. After installation, PostgreSQL should start automatically

**For Mac:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**For Linux:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Verify PostgreSQL is running:**
```bash
psql --version
```

---

### Step 3: Install Git (Optional but Recommended)

**For Windows:**
- Download from https://git-scm.com/download/win
- Install with default settings

**For Mac:**
```bash
brew install git
```

**For Linux:**
```bash
sudo apt install git
```

---

## 🏗️ Project Setup

### Step 1: Create Project Folder

Open your terminal/command prompt and run:

```bash
# Create project folder
mkdir nutribreakfast-backend
cd nutribreakfast-backend

# Initialize npm project
npm init -y
```

This creates a `package.json` file.

---

### Step 2: Install All Dependencies

Copy and paste this entire command:

```bash
npm install @anthropic-ai/sdk@^0.27.0 @prisma/client@^5.7.0 bcryptjs@^2.4.3 cors@^2.8.5 dotenv@^16.3.1 express@^4.18.2 express-rate-limit@^7.1.5 helmet@^7.1.0 jsonwebtoken@^9.0.2 morgan@^1.10.0 nodemailer@^6.9.7 winston@^3.11.0 zod@^3.22.4 axios@^1.6.2 multer@^1.4.5-lts.1 cloudinary@^1.41.0 node-cron@^3.0.3
```

Then install development dependencies:

```bash
npm install --save-dev nodemon@^3.0.2 prisma@^5.7.0 eslint@^8.55.0
```

**What just happened?**
- npm downloaded and installed all the libraries our project needs
- You'll see a new `node_modules` folder (this is huge - it's normal!)
- A `package-lock.json` file was created

---

### Step 3: Create Project Structure

Run these commands to create all folders:

**For Windows (Command Prompt):**
```bash
mkdir src
mkdir src\config
mkdir src\middleware
mkdir src\controllers
mkdir src\services
mkdir src\routes
mkdir src\utils
mkdir prisma
mkdir logs
```

**For Mac/Linux:**
```bash
mkdir -p src/{config,middleware,controllers,services,routes,utils}
mkdir -p prisma
mkdir -p logs
```

Your folder structure should now look like:
```
nutribreakfast-backend/
├── node_modules/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   └── utils/
├── prisma/
├── logs/
├── package.json
└── package-lock.json
```

---

### Step 4: Create Configuration Files

#### Create `.env` file in the root folder:

**Windows:** Create a new file called `.env` (no extension) using Notepad
**Mac/Linux:** 
```bash
touch .env
```

Open it and paste:

```env
# Server
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/nutribreakfast?schema=public"

# JWT (generate random strings for these)
JWT_SECRET=change-this-to-random-string-abc123xyz789
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=another-random-string-def456uvw012
JWT_REFRESH_EXPIRES_IN=30d

# Anthropic AI (get from https://console.anthropic.com/)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Paystack (get from https://dashboard.paystack.com/)
PAYSTACK_SECRET_KEY=sk_test_your-key-here
PAYSTACK_PUBLIC_KEY=pk_test_your-key-here

# Email (using Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="NutriBreakfast <noreply@nutribreakfast.com>"

# Frontend
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**⚠️ IMPORTANT:** 
- Replace `YOUR_PASSWORD_HERE` with your PostgreSQL password
- Keep the rest as-is for now (we'll add real API keys later)

#### Create `.gitignore` file:

```bash
# For Windows
type nul > .gitignore

# For Mac/Linux
touch .gitignore
```

Open it and paste:

```
node_modules/
.env
logs/
*.log
.DS_Store
prisma/migrations/
```

---

### Step 5: Copy All Code Files

Now copy the code I provided earlier into these files:

1. **prisma/schema.prisma** - Copy the database schema
2. **src/app.js** - Main application file
3. **src/config/database.js** - Database connection
4. **src/utils/logger.js** - Logging utility
5. **src/middleware/errorHandler.js** - Error handling

Use your text editor (VS Code recommended) to create and paste the code.

---

### Step 6: Setup Database

#### Create the Database:

**Windows (using pgAdmin or command line):**
```bash
# Open PowerShell or CMD as Administrator
psql -U postgres
# Enter your password when prompted
```

**Mac/Linux:**
```bash
sudo -u postgres psql
```

**In the PostgreSQL prompt, run:**
```sql
CREATE DATABASE nutribreakfast;
\q
```

#### Generate Prisma Client:

```bash
npx prisma generate
```

#### Run Database Migrations:

```bash
npx prisma migrate dev --name init
```

This creates all the tables in your database!

**If you see errors:** Make sure your DATABASE_URL in `.env` is correct.

---

### Step 7: Install Recommended VS Code Extensions

If you're using VS Code (highly recommended):

1. Open VS Code
2. Go to Extensions (Ctrl + Shift + X)
3. Install these:
   - **Prisma** (for database schema syntax highlighting)
   - **ESLint** (for code quality)
   - **REST Client** (for testing API)
   - **GitLens** (optional, for Git)

---

### Step 8: Update package.json Scripts

Open `package.json` and make sure the "scripts" section looks like this:

```json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio",
  "prisma:seed": "node prisma/seed.js"
}
```

---

## 🎯 Running the Application

### Start Development Server:

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 5000 in development mode
📡 API available at http://localhost:5000/api/v1
✅ Database connected successfully
```

### Test the API:

Open your browser and go to:
```
http://localhost:5000/health
```

You should see:
```json
{
  "status": "success",
  "message": "NutriBreakfast API is running",
  "timestamp": "2024-12-07T...",
  "environment": "development"
}
```

**🎉 Congratulations! Your backend is running!**

---

## 🛠️ Useful Commands

```bash
# Start server (production mode)
npm start

# Start server (development mode with auto-reload)
npm run dev

# Generate Prisma client after schema changes
npm run prisma:generate

# Create a new database migration
npm run prisma:migrate

# Open Prisma Studio (visual database editor)
npm run prisma:studio

# View all npm scripts
npm run
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Port 5000 already in use"

**Solution:**
- Kill the process using port 5000
- Or change PORT in `.env` to 5001, 8000, etc.

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID [PID_NUMBER] /F
```

**Mac/Linux:**
```bash
lsof -ti:5000 | xargs kill -9
```

### Issue 2: "Cannot connect to database"

**Solutions:**
1. Check PostgreSQL is running
2. Verify DATABASE_URL in `.env` has correct password
3. Make sure database `nutribreakfast` exists

### Issue 3: "Module not found"

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue 4: Prisma errors

**Solution:**
```bash
npx prisma generate
npx prisma migrate reset
npx prisma migrate dev
```

---

## 📚 What's Next?

Now that your backend is set up and running, we'll add:

1. ✅ Authentication routes (login, register)
2. ✅ User management
3. ✅ AI meal recommendations
4. ✅ Order management
5. ✅ Payment integration

---

## 💡 Pro Tips

1. **Always run `npm run dev`** during development (auto-reloads on changes)
2. **Use Prisma Studio** to view your database visually: `npm run prisma:studio`
3. **Check logs** in the `logs/` folder if something breaks
4. **Keep `.env` secure** - never commit it to Git

---

## 📞 Need Help?

If you get stuck:
1. Check the error message carefully
2. Google the error (Stack Overflow is your friend!)
3. Check logs in `logs/error.log`
4. Ask me specific questions about the error

---

## ✅ Checklist

- [ ] Node.js installed (v20+)
- [ ] PostgreSQL installed and running
- [ ] Project folder created
- [ ] Dependencies installed
- [ ] `.env` file created with correct DATABASE_URL
- [ ] Database created
- [ ] Prisma migrations run
- [ ] Server starts without errors
- [ ] Health check endpoint works

Once all checkboxes are ✅, you're ready to continue building!


📝 Summary of Credentials
Staff (Mobile App):

Email: john.doe@techcorp.ng
Password: password123

Company Admin:

Email: admin@techcorp.ng
Password: techcorp123 (or whatever the script generated)

Super Admin:

Email: admin@nutribreakfast.com
Password: admin123