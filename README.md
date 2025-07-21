# AI Email Sorter

## 📺 Application Overview

[![AI Email Sorter Overview](https://img.youtube.com/vi/YOUR_VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)

> Click the image above to watch a short video overview of the app in action!

AI Email Sorter is a modern, full-stack web application for managing and organizing Gmail accounts with the power of AI. It provides multi-account Gmail integration, AI-powered email categorization and summarization, bulk actions (delete, archive, unsubscribe), and a beautiful, responsive dashboard UI.

---

## Features

- **Google OAuth Sign-In**: Secure authentication with Google, supporting multiple Gmail accounts per user.
- **AI-Powered Categorization**: Uses Google Gemini AI to automatically categorize and summarize emails.
- **Multi-Account Gmail Integration**: Connect, monitor, and manage multiple Gmail accounts from a single dashboard.
- **Bulk Actions**: Archive, delete, or unsubscribe from emails in bulk, with AI-assisted unsubscribe and Playwright browser automation.
- **Email Details & Summaries**: View original emails, AI-generated summaries, and take actions from a modal dialog.
- **Responsive & Accessible UI**: Built with Next.js, React, shadcn/ui, and Tailwind CSS for a seamless experience on any device.
- **Robust Testing**: Comprehensive unit, integration, and E2E tests using Jest and Playwright.

---

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, NextAuth.js, Prisma ORM, PostgreSQL
- **AI**: Google Gemini (2.0 Flash, 2.5 Pro)
- **Gmail Integration**: Google Gmail API
- **Automation**: Playwright (for unsubscribe automation)
- **Queueing**: Upstash QStash
- **Testing**: Jest, Testing Library, Playwright, MSW

---

## Getting Started

### 1. **Clone the Repository**
```bash
git clone https://github.com/your-org/ai-email-sorter.git
cd ai-email-sorter
```

### 2. **Install Dependencies**
```bash
pnpm install
```

### 3. **Set Up Environment Variables**
Create a `.env` file in the root with the following (see `.env.example` if available):
```
DATABASE_URL=postgresql://user:password@localhost:5432/ai-email-sorter
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_AI_API_KEY=your-gemini-api-key
NEXTAUTH_SECRET=your-nextauth-secret
QSTASH_TOKEN=your-qstash-token
...
```

### 4. **Set Up the Database**
```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

### 5. **Run the App**
```bash
pnpm dev
```
Visit [http://localhost:3000](http://localhost:3000) to get started.

---

## Testing

- **Unit/Integration Tests:**
  ```bash
  pnpm test
  ```
- **E2E Tests (Playwright):**
  ```bash
  pnpm test:e2e
  ```
---

## Architecture Overview

- **Authentication:** NextAuth.js with Google OAuth and JWT sessions.
- **Database:** Prisma ORM with PostgreSQL, supporting multi-account and user isolation.
- **Gmail Integration:** Uses Gmail API for fetching, archiving, and deleting emails. Gmail watch/webhook for real-time updates.
- **AI Integration:** Google Gemini for categorization, summarization, and unsubscribe link analysis.
- **Unsubscribe Automation:** Playwright browser automation for AI-detected unsubscribe links.
- **Queueing:** Upstash QStash for background job processing.
- **UI:** Componentized, accessible, and responsive with shadcn/ui and Tailwind CSS.
- **Testing:** Comprehensive coverage with Jest, Testing Library, Playwright, and MSW.

---

## Key Files & Directories

- `src/app/` — Next.js app directory (pages, API routes, actions)
- `src/components/` — UI and dashboard components
- `src/services/` — Gmail, AI, unsubscribe, and browser automation services
- `src/lib/` — Auth, Prisma, and utility libraries
- `src/__tests__/` — Unit and integration tests
- `e2e/` — Playwright E2E tests
- `UNSUBSCRIBE_FEATURE_IMPLEMENTATION.md` — Technical doc for the unsubscribe feature
- `TESTING_GUIDELINE.md` — Testing strategy and best practices

---

## License

This project is licensed under the MIT License. 