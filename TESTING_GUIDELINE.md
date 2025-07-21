# AI Email Sorter – Testing Guideline

## Overview
This document provides a streamlined, high-impact testing strategy for the AI Email Sorter app. It prioritizes features that are critical to business value, user experience, and reliability, while keeping implementation time short and code quality high. The goal is to maximize coverage and confidence with minimal overhead, using modern best practices and tools.

---

## 1. **Testing Philosophy**
- **Test what matters:** Focus on business logic, integration points, and user flows.
- **Automate the critical path:** Cover sign-in, category management, email processing, and bulk actions.
- **Skip what’s not critical:** Avoid over-testing UI details, third-party libraries, or trivial getters/setters.
- **Use AI to accelerate:** Leverage AI tools to generate and refactor tests quickly.

---

## 2. **Recommended Tools**
- **Unit/Integration:** [Jest](https://jestjs.io/) + [Testing Library](https://testing-library.com/) (React, Next.js)
- **E2E:** [Playwright](https://playwright.dev/) (already installed, great for email flows)
- **Mocking:** [msw](https://mswjs.io/) for API mocking
- **CI:** GitHub Actions or Vercel CI (optional, for PRs)

---

## 3. **What to Test (and Why)**

### **A. Authentication & Account Management**
- **Sign in with Google** (mock OAuth flow)
- **Connect/disconnect Gmail accounts**
- **Account switching**

### **B. Category Management**
- **Add new category (form validation, DB write)**
- **List categories (UI, DB read)**
- **Category uniqueness per user**

### **C. Email Processing**
- **AI categorization and summarization (mock AI response)**
- **Email import and archiving (mock Gmail API)**
- **Display of emails in categories**

### **D. Bulk Actions**
- **Bulk delete (removes from app and Gmail, multi-account)**
- **Bulk unsubscribe (AI link detection, Playwright automation, status feedback)**
- **Single email actions (delete, unsubscribe, view in Gmail)**

### **E. UI/UX**
- **Loading states and error toasts**
- **Confirmation dialogs**
- **Critical navigation (dashboard, category, email details)**

### **F. Security & Permissions**
- **User isolation (cannot access others’ emails/categories)**
- **API route protection (mock session)**

---

## 4. **What NOT to Test**
- CSS details, pixel-perfect rendering
- Third-party library internals (e.g., shadcn/ui, Tailwind)
- Static content, icons, or trivial computed values
- Google OAuth flow end-to-end (mock it instead)

---

## 5. **Test Structure & Examples**

### **A. Unit/Integration Tests (Jest + Testing Library)**
- `src/__tests__/` for logic and API tests
- `src/components/__tests__/` for UI tests
- **Example:**
  - `category.test.ts` – add/list categories, validation
  - `email-processing.test.ts` – AI categorization, DB writes (mock AI)
  - `bulk-actions.test.ts` – delete/unsubscribe logic (mock Gmail/Playwright)

### **B. E2E Tests (Playwright)**
- `e2e/` directory
- **Example flows:**
  - Sign in, add category, import email, see summary
  - Select emails, bulk delete, verify removal
  - Select emails, bulk unsubscribe, verify status
  - Open email details, use unsubscribe/delete

---

## 6. **Best Practices**
- **Mock external APIs:** Use msw or Playwright’s network mocking for Gmail, AI, OAuth.
- **Seed test data:** Use a test DB or in-memory DB for integration tests.
- **Isolate tests:** Clean up DB and mocks between tests.
- **Fast feedback:** Run unit/integration tests on every commit; E2E on demand or nightly.
- **Use AI to generate/refactor tests:** Save time on boilerplate.

---

## 7. **Implementation Order (Streamlined)**
1. **Unit/integration tests for business logic:**
   - Category add/list
   - Email import/categorization (mock AI)
   - Bulk delete/unsubscribe (mock Gmail/Playwright)
2. **Critical UI tests:**
   - Category page (add/list)
   - Email details modal (actions)
3. **E2E happy path:**
   - Sign in, add category, import email, bulk actions
4. **Security/permission tests:**
   - User isolation, API protection

---

## 8. **How to Run Tests**
- **Unit/Integration:**
  ```bash
  pnpm test
  # or
  pnpm jest
  ```
- **E2E:**
  ```bash
  pnpm exec playwright test
  ```

---

## 9. **Final Tips**
- Focus on the flows that would break the app or lose user data if they failed.
- Use mocks for all external dependencies.
- Don’t over-test UI details—test what the user/business cares about.
- Use AI to help write and refactor tests for speed.

---

## 10. **References**
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Library Docs](https://testing-library.com/docs/)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [MSW Docs](https://mswjs.io/docs/)

---

**This guideline will help you implement high-value tests quickly and confidently, meeting the challenge requirements and your deadline.** 