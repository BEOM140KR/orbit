# 🌌 Orbit News Dashboard
**Your Personalized Universe of News, Powered by AI.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-blue?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)

Orbit is a modern, AI-integrated news dashboard designed to cut through the noise. It provides personalized news feeds, instant AI-generated summaries, and cost-efficient multi-language support—all wrapped in a sleek, mobile-optimized glassmorphic UI.

---

## ✨ Key Features

### 🧠 AI-Powered Insights
- **Smart Summarization**: Instant news summaries using Google Gemini 1.5 Flash, cached for efficiency and cost optimization.
- **Personalized Feed**: Content tailored to your specific keywords and interests.

### 🌍 Global Accessibility
- **Zero-Cost Translation**: Browser-native translation integration (KO, EN, JA) with a Safari-compatible custom UI.
- **Brand Protection**: Ensures brand names and critical UI elements aren't distorted during translation using `notranslate` guards.

### 📱 Responsive & Fluid
- **Mobile-First Design**: Optimized for mobile webviews with fixed navigation, smooth modal transitions, and scroll-lock mechanics.
- **Glassmorphic UI**: A premium, futuristic interface with high-end aesthetics (vibrant gradients, backdrop blurs).

### 🔒 Enterprise-Grade Security
- **SSRF Defense**: Robust server-side URL validation and internal IP blacklisting for the AI summary engine.
- **Strict Headers**: Comprehensive HTTP security headers (CSP, HSTS, X-Frame-Options) for production-ready safety.
- **Auth Separation**: Firebase Admin SDK token verification on absolute server-side routes.

---

## 🛠️ Tech Stack

- **Core**: Next.js 15 (App Router), React 19, TypeScript
- **Backend/DB**: MongoDB (Mongoose), Node.js
- **Auth**: Firebase Authentication (Client & Admin SDK)
- **AI**: Google Gemini AI (Google AI Studio)
- **Styling**: Vanilla CSS with modern Glassmorpishm effects

---

## ⚙️ Development & Setup

### Environment Variables
Create a `.env.local` file with the following keys:

```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=...
# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# MongoDB
MONGODB_URI=mongodb+srv://.../orbit?appName=Cluster

# AI & APIs
GEMINI_API_KEY=...
NEWS_API_KEY=...
```

### Installation
```bash
npm install
npm run dev
```

---

## 🚀 Deployment

The project is optimized for **Vercel**. 
1. Connect your GitHub repository.
2. Add your environment variables in the Vercel dashboard.
3. Ensure `MONGODB_URI` points to the `orbit` database.
4. Deploy and enjoy your personalized news universe!

---

## 🛰️ Vision

Orbit aims to redefine how we consume global information—making it faster, safer, and more accessible without expensive translation overhead.

*Project Modernized and Secured by Antigravity AI.*
