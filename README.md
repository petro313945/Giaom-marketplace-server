# Giaom Marketplace Server

Express.js backend server for Giaom Marketplace.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
```bash
cp .env.example .env
```
Then edit `.env` with your configuration.

### 3. Run Development Server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🔧 Environment Variables

See `.env.example` for required environment variables.

## 📁 Project Structure

```
src/
├── server.ts          # Main server entry point
├── config/         # Configuration files
├── models/            # Mongoose models
├── routes/           # API routes
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
└── utils/            # Utility functions
```
