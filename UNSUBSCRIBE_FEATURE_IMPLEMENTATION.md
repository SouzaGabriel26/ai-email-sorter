# AI Unsubscribe Feature Implementation Guide

## Overview

This document outlines the step-by-step implementation of the AI-powered unsubscribe feature that allows users to automatically unsubscribe from email newsletters by analyzing email content, finding unsubscribe links, and using AI to navigate and complete the unsubscribe process.

## Current Architecture Analysis

### ✅ **What's Already Working**
- **Email Selection System**: Multi-select checkboxes with bulk actions
- **Email Content Storage**: Full HTML/text content in database
- **AI Processing Pipeline**: Gemini 2.5 Pro for categorization/summarization
- **Gmail Integration**: OAuth2 authentication with token refresh
- **Background Job Processing**: QStash for async operations
- **Database Schema**: Complete email storage with bodyHtml/bodyText
- **UI Components**: ConfirmDialog, toast notifications, loading states

### 🎯 **Implementation Strategy**
Follow existing patterns: **Server Actions** → **Background Jobs** → **AI Processing** → **User Feedback**

## Phase 1: Unsubscribe Link Detection

### Step 1.1: Create Unsubscribe Link Parser Service

**File**: `src/services/unsubscribe.service.ts`

```typescript
export interface UnsubscribeLink {
  url: string;
  text: string;
  type: 'link' | 'button' | 'email';
  confidence: number;
}

export class UnsubscribeService {
  async findUnsubscribeLinks(emailContent: EmailContent): Promise<UnsubscribeLink[]> {
    // Parse HTML and text content for unsubscribe patterns
    // Use regex patterns and AI analysis
    // Return structured unsubscribe links
  }
}
```

### Step 1.2: Add Unsubscribe Link Detection to Email Processing

**File**: `src/services/ai.service.ts`

```typescript
// Add to existing AIService class
async analyzeUnsubscribeLinks(emailContent: EmailContent): Promise<UnsubscribeLink[]> {
  // Use Gemini to analyze email content for unsubscribe links
  // Parse HTML structure and text patterns
  // Return structured unsubscribe opportunities
}
```

### Step 1.3: Update Database Schema

**File**: `prisma/schema.prisma`

```prisma
model Email {
  // ... existing fields ...
  unsubscribeLinks Json? // Store detected unsubscribe links
  unsubscribeStatus String? // 'pending', 'processing', 'completed', 'failed'
  unsubscribeAttemptedAt DateTime?
}
```

## Phase 2: Unsubscribe Action Implementation

### Step 2.1: Create Unsubscribe Server Action

**File**: `src/app/actions/unsubscribe.ts`

```typescript
export async function unsubscribeFromEmailsAction(emailIds: string[]) {
  // 1. Get email details from database
  // 2. Extract unsubscribe links
  // 3. Queue unsubscribe jobs for each email
  // 4. Return job status to user
}
```

### Step 2.2: Create Unsubscribe Job Type

**File**: `src/lib/qstash.ts`

```typescript
export interface UnsubscribeJobData {
  emailId: string;
  userId: string;
  unsubscribeLinks: UnsubscribeLink[];
  accountEmail: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId: string;
}
```

### Step 2.3: Create Unsubscribe Processing API

**File**: `src/app/api/unsubscribe/process/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Validate job data
  // 2. Use Playwright to navigate to unsubscribe links
  // 3. Use AI to analyze page and complete unsubscribe
  // 4. Update database with results
  // 5. Return success/failure status
}
```

## Phase 3: AI-Powered Browser Automation

### Step 3.1: Install Playwright

```bash
pnpm add playwright
pnpm exec playwright install chromium
```

### Step 3.2: Create Browser Automation Service

**File**: `src/services/browser.service.ts`

```typescript
export class BrowserService {
  async unsubscribeFromLink(
    unsubscribeLink: UnsubscribeLink,
    userEmail: string
  ): Promise<UnsubscribeResult> {
    // 1. Launch headless browser
    // 2. Navigate to unsubscribe URL
    // 3. Use AI to analyze page structure
    // 4. Complete unsubscribe form/process
    // 5. Verify success
  }
}
```

### Step 3.3: Create AI Page Analysis

**File**: `src/services/ai.service.ts`

```typescript
// Add to existing AIService class
async analyzeUnsubscribePage(
  pageHtml: string,
  pageUrl: string,
  userEmail: string
): Promise<UnsubscribeAction[]> {
  // Use Gemini to analyze page and determine actions needed
  // Return structured actions (click, fill, submit, etc.)
}
```

## Phase 4: UI Integration

### Step 4.1: Update Email List Component

**File**: `src/components/emails/email-list.tsx`

```typescript
// Add unsubscribe status indicators
// Show unsubscribe links if detected
// Add unsubscribe button to individual emails
```

### Step 4.2: Update Category Header

**File**: `src/components/emails/category-header.tsx`

```typescript
// Update handleUnsubscribeSelected to use new action
const handleUnsubscribeSelected = async () => {
  const { unsubscribeFromEmailsAction } = await import("../../actions/unsubscribe");
  // Call the new unsubscribe action
};
```

### Step 4.3: Update Email Viewer

**File**: `src/components/emails/email-viewer.tsx`

```typescript
// Add unsubscribe button functionality
// Show detected unsubscribe links
// Display unsubscribe status
```

## Phase 5: Database Schema Updates

### Step 5.1: Create Migration

```bash
npx prisma migrate dev --name add_unsubscribe_fields
```

### Step 5.2: Update Prisma Schema

```prisma
model Email {
  // ... existing fields ...
  
  // Unsubscribe tracking
  unsubscribeLinks Json? // Array of UnsubscribeLink objects
  unsubscribeStatus String? // 'pending', 'processing', 'completed', 'failed'
  unsubscribeAttemptedAt DateTime?
  unsubscribeCompletedAt DateTime?
  unsubscribeError String? // Error message if failed
  
  // ... existing relations and indexes ...
}
```

## Phase 6: Error Handling & User Feedback

### Step 6.1: Create Unsubscribe Status Types

```typescript
export type UnsubscribeStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'no_links_found';

export interface UnsubscribeResult {
  success: boolean;
  status: UnsubscribeStatus;
  error?: string;
  actionsTaken: string[];
}
```

### Step 6.2: Add Toast Notifications

```typescript
// Success cases
toast.success("Unsubscribe completed", {
  description: "Successfully unsubscribed from 3 emails"
});

// Error cases
toast.error("Unsubscribe failed", {
  description: "Failed to unsubscribe from 2 emails. Check logs for details."
});
```

## Phase 7: Testing & Validation

### Step 7.1: Create Test Emails

- Create test emails with various unsubscribe link formats
- Test different unsubscribe page layouts
- Validate AI analysis accuracy

### Step 7.2: Add Logging

```typescript
logger.info("Starting unsubscribe process", {
  emailId,
  unsubscribeLinks: links.length,
  userEmail
});

logger.info("Unsubscribe completed", {
  emailId,
  success: true,
  actionsTaken: ["clicked_button", "filled_form"]
});
```

## Implementation Order

### **Week 1: Foundation**
1. ✅ Create UnsubscribeService with link detection
2. ✅ Update database schema
3. ✅ Add unsubscribe fields to Email model
4. ✅ Create unsubscribe server action

### **Week 2: AI Integration**
1. ✅ Install and configure Playwright
2. ✅ Create BrowserService for automation
3. ✅ Implement AI page analysis
4. ✅ Create unsubscribe processing API

### **Week 3: UI & Testing**
1. ✅ Update UI components
2. ✅ Add unsubscribe status indicators
3. ✅ Implement error handling
4. ✅ Add comprehensive logging
5. ✅ Test with various email types

## Technical Considerations

### **Security**
- ✅ Validate all URLs before navigation
- ✅ Sanitize user input in forms
- ✅ Use headless browser for security
- ✅ Implement rate limiting

### **Performance**
- ✅ Process unsubscribe jobs asynchronously
- ✅ Use connection pooling for database
- ✅ Implement browser instance reuse
- ✅ Add timeout handling

### **Reliability**
- ✅ Retry failed unsubscribe attempts
- ✅ Handle network timeouts
- ✅ Validate unsubscribe success
- ✅ Store detailed error logs

### **User Experience**
- ✅ Show real-time progress
- ✅ Provide detailed feedback
- ✅ Allow manual override
- ✅ Track unsubscribe history

## File Structure

```
src/
├── services/
│   ├── unsubscribe.service.ts     # Link detection & analysis
│   └── browser.service.ts         # Playwright automation
├── app/
│   ├── actions/
│   │   └── unsubscribe.ts        # Server action
│   └── api/
│       └── unsubscribe/
│           └── process/
│               └── route.ts       # Background job handler
├── components/
│   └── emails/
│       ├── email-list.tsx        # Updated with unsubscribe UI
│       ├── category-header.tsx   # Updated with unsubscribe button
│       └── email-viewer.tsx      # Updated with unsubscribe status
└── lib/
    └── qstash.ts                 # Updated with unsubscribe job type
```

## Success Metrics

- ✅ **Link Detection Accuracy**: >90% of unsubscribe links found
- ✅ **Unsubscribe Success Rate**: >80% successful unsubscribes
- ✅ **Processing Time**: <30 seconds per email
- ✅ **User Satisfaction**: Clear feedback and status updates
- ✅ **Error Recovery**: Graceful handling of failures

## Risk Mitigation

### **Technical Risks**
- **Browser Automation Failures**: Implement fallback mechanisms
- **AI Analysis Errors**: Add manual override options
- **Rate Limiting**: Implement exponential backoff
- **Memory Leaks**: Proper browser cleanup

### **User Experience Risks**
- **False Positives**: Clear unsubscribe confirmation
- **Incomplete Unsubscribes**: Detailed status reporting
- **Privacy Concerns**: Secure handling of user data
- **Performance Issues**: Async processing with progress updates

This implementation follows the existing project patterns and integrates seamlessly with the current architecture while adding powerful AI-driven unsubscribe capabilities. 