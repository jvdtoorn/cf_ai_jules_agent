# Testing Guide

This document provides comprehensive testing instructions for the personal chatbot.

## 🧪 Pre-Deployment Testing

### 1. Environment Setup

Before testing, ensure:

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm packages are installed
npm list | grep workers-ai-provider
npm list | grep agents

# Verify wrangler is available
npx wrangler --version
```

### 2. Local Development Testing

Start the development server:

```bash
npm start
```

Visit `http://localhost:8787` and verify:

- [ ] Page loads without errors
- [ ] Dark/light theme toggle works
- [ ] Chat interface is responsive
- [ ] Welcome message displays correctly

## 🔍 Functional Testing

### Cookie & Session Management

**Test 1: New Session Creation**
1. Open browser in incognito mode
2. Visit the chatbot
3. Open DevTools → Application → Cookies
4. Verify `session_id` cookie exists with:
   - HttpOnly flag ✓
   - Secure flag ✓
   - SameSite=Strict ✓
   - 7-day expiry ✓

**Test 2: Session Persistence**
1. Send a message in the chat
2. Refresh the page
3. Verify conversation history persists
4. Check that same `session_id` cookie is used

**Test 3: Multiple Sessions**
1. Open two different browser profiles or incognito windows
2. Chat in both simultaneously
3. Verify conversations are isolated
4. Each should have different `session_id` cookies

### RAG System

**Test 4: Document Query (After Ingestion)**

Prerequisites: You must have ingested documents first (see setup-documents.md)

Try these queries:
```
"What programming languages does Jules know?"
"Tell me about Jules' education"
"What projects has Jules worked on?"
"Describe Jules' work experience"
```

Expected behavior:
- [ ] Response includes specific information from CV
- [ ] Information is accurate and relevant
- [ ] Response is in first person (as Jules)
- [ ] Response time is reasonable (< 5 seconds)

**Test 5: Document Not Found**
```
"What is Jules' favorite ice cream flavor?"
```

Expected behavior:
- [ ] Bot acknowledges it doesn't have that information
- [ ] May suggest downloading CV for more details

### User Memory

**Test 6: Name Recognition**
1. Send: "Hi, I'm Sarah from Cloudflare"
2. Expected response includes acknowledgment of name
3. Start a new session (new incognito window with same session_id)
4. Bot should greet: "Welcome back, Sarah!"

**Test 7: Name Storage**
1. Introduce yourself with a name
2. Open DevTools Console
3. Check network tab for database writes
4. Verify user profile is stored in Durable Object SQL

### Document Reply Tool

**Test 8: Document Request**
```
"Can you send me your CV?"
"I'd like to see your cover letter"
```

Expected behavior:
- [ ] Bot acknowledges the request
- [ ] Provides a download link or instructions
- [ ] Link format is correct

### Conversation Management

**Test 9: Message History**
1. Send several messages
2. Verify all messages appear in order
3. Check timestamps are displayed
4. Verify AI responses stream in real-time

**Test 10: Clear History**
1. Have a conversation
2. Click trash icon in header
3. Verify all messages are cleared
4. Verify UI shows welcome message again

## 🚀 Deployment Testing

### Before Deployment

```bash
# Check for linting errors
npm run check

# Run tests (if any)
npm test

# Verify wrangler config
cat wrangler.jsonc
```

### Deploy

```bash
npm run deploy
```

### Post-Deployment Verification

**Test 11: Production Endpoint**
1. Visit your deployed worker URL
2. Verify HTTPS is enabled
3. Test all functional tests above in production
4. Check Cloudflare dashboard for:
   - Worker invocations
   - Durable Object requests
   - Vectorize queries

**Test 12: Admin Endpoint Security**

⚠️ **Security Test** - Ensure `/admin/ingest` is not publicly accessible or add authentication

```bash
# Try to access admin endpoint
curl https://your-worker.workers.dev/admin/ingest

# Should return 401 Unauthorized or require auth in production
```

## 🕒 Cron Testing

**Test 13: Weekly Cleanup Verification**

The cron job runs Sundays at midnight UTC. To verify:

1. Check Cloudflare Dashboard → Workers → Cron Triggers
2. Verify schedule: `0 0 * * 0`
3. Monitor logs on Sunday night
4. Verify conversations are cleared

Manual trigger (if supported):
```bash
npx wrangler tail --cron-triggers
```

## 📊 Performance Testing

**Test 14: Response Time**
- First message: < 3 seconds
- Subsequent messages: < 2 seconds
- RAG queries: < 5 seconds
- Document downloads: < 1 second

**Test 15: Load Testing (Optional)**

Use a tool like `k6` or `wrk`:

```bash
# Install k6
brew install k6

# Run basic load test
k6 run - <<EOF
import http from 'k6/http';
import { sleep } from 'k6';

export default function() {
  http.get('https://your-worker.workers.dev');
  sleep(1);
}
EOF
```

## 🔐 Security Testing

**Test 16: XSS Protection**
Try sending:
```
"<script>alert('xss')</script>"
"<img src=x onerror=alert('xss')>"
```

Expected: Properly escaped/sanitized in UI

**Test 17: Cookie Tampering**
1. Get session_id cookie value
2. Modify it manually in DevTools
3. Refresh page
4. Should create new session or handle gracefully

**Test 18: CSRF Protection**
- SameSite=Strict cookie should prevent CSRF
- Test by making cross-origin requests

## 🐛 Error Handling

**Test 19: Network Errors**
1. Enable offline mode in DevTools
2. Try sending a message
3. Verify graceful error handling

**Test 20: Invalid Vectorize Queries**
Before ingesting documents:
```
"What is Jules' experience?"
```

Expected:
- [ ] Doesn't crash
- [ ] Returns helpful error or fallback message

**Test 21: Rate Limiting**
Send many messages rapidly. Verify:
- [ ] System remains responsive
- [ ] No crashes or timeouts
- [ ] Reasonable rate limiting (if implemented)

## ✅ Testing Checklist

Before considering the project complete:

### Core Functionality
- [ ] Cookie-based sessions work
- [ ] Conversation history persists
- [ ] RAG queries return relevant results
- [ ] User names are remembered
- [ ] Document replies work
- [ ] Weekly cleanup is scheduled

### Security
- [ ] Cookies are HttpOnly, Secure, SameSite=Strict
- [ ] XSS protection works
- [ ] Admin endpoints are protected
- [ ] Session IDs are cryptographically secure

### UI/UX
- [ ] Welcome message is clear
- [ ] Messages stream in real-time
- [ ] Theme toggle works
- [ ] Mobile responsive
- [ ] Clear history works

### Performance
- [ ] Response times are acceptable
- [ ] No memory leaks in long sessions
- [ ] Handles concurrent users

### Documentation
- [ ] README is clear and complete
- [ ] IMPLEMENTATION.md is accurate
- [ ] setup-documents.md is helpful
- [ ] All example files are present

## 🎯 Success Criteria

The chatbot is ready for demonstration when:

1. ✅ All assignment requirements are met (LLM, Workflow, User Input, Memory)
2. ✅ Recruiter can have natural conversation
3. ✅ RAG system provides accurate information
4. ✅ Sessions persist across page refreshes
5. ✅ User names are remembered
6. ✅ Security best practices are implemented
7. ✅ Documentation is comprehensive
8. ✅ No critical bugs or errors

## 🔧 Troubleshooting

### Common Issues

**Issue**: Vectorize queries return no results
- **Solution**: Ensure documents are ingested and index is created

**Issue**: Session not persisting
- **Solution**: Check cookie settings, ensure HTTPS in production

**Issue**: Workers AI errors
- **Solution**: Verify AI binding in wrangler.jsonc, check quotas

**Issue**: Durable Object errors
- **Solution**: Check migrations in wrangler.jsonc, verify binding

**Issue**: CORS errors
- **Solution**: Ensure proper headers in worker responses

## 📝 Test Results Template

Use this to document your testing:

```markdown
## Test Results - [Date]

### Environment
- Browser: [Chrome/Firefox/Safari]
- OS: [macOS/Windows/Linux]
- Environment: [Local/Production]

### Test Results
- Cookie & Sessions: ✅ / ❌
- RAG System: ✅ / ❌
- User Memory: ✅ / ❌
- Document Replies: ✅ / ❌
- Security: ✅ / ❌
- Performance: ✅ / ❌

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Any additional observations]
```

## 🎉 Final Verification

Before submitting your internship application:

1. [ ] Test all features end-to-end
2. [ ] Verify on multiple browsers
3. [ ] Check on mobile device
4. [ ] Review all documentation
5. [ ] Test as if you're a recruiter
6. [ ] Fix any critical bugs
7. [ ] Deploy to production
8. [ ] Share the link!

Good luck with your Cloudflare internship application! 🚀
