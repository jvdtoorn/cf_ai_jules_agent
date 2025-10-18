# Personal Chatbot Implementation

This document describes the implementation of the personal AI chatbot for Jules' Cloudflare internship application.

## 🎯 Assignment Requirements

✅ **LLM**: Llama 3.3 on Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)  
✅ **Workflow/Coordination**: Cloudflare Durable Objects + Agents SDK  
✅ **User Input**: Chat interface via React UI  
✅ **Memory/State**: Vectorize (for documents) + Durable Objects SQL (for conversations) + cookies (for sessions)

## 🏗️ Architecture

### Core Components

1. **Anonymous Session Management**
   - Cryptographically secure session IDs generated with `crypto.getRandomValues()`
   - HttpOnly, Secure, SameSite=Strict cookies
   - Each session maps to a unique Durable Object instance
   - No login required - frictionless chat experience

2. **Vectorize (RAG System)**
   - Stores embeddings of CV and cover letter
   - Uses Workers AI embeddings model: `@cf/baai/bge-base-en-v1.5`
   - Semantic search for answering specific questions
   - Configured in `wrangler.jsonc` as `VECTORIZE` binding

3. **Durable Objects SQL**
   - Per-user conversation history
   - User profile tracking (name, first seen, last seen)
   - Isolated per session for privacy
   - Native Cloudflare - zero external dependencies

4. **Workers AI Integration**
   - Replaced OpenAI with Llama 3.3
   - Using `workers-ai-provider` package
   - No external API keys required
   - Fully runs on Cloudflare infrastructure


## 📁 File Structure

```
src/
├── server.ts           # Main worker + Chat agent class
├── tools.ts            # AI tools (RAG, memory, documents)
├── ingest-documents.ts # Document embedding utilities
├── app.tsx             # React UI (updated branding)
└── ...

wrangler.jsonc          # Cloudflare config (Vectorize, DO)
setup-documents.md      # Guide for ingesting CV/cover letter
```

## 🔧 Key Features

### 1. RAG Tool (`queryPersonalInfo`)
- Automatically searches CV/cover letter for relevant information
- Returns top 5 most relevant chunks
- Used when recruiter asks specific questions about experience, skills, etc.

### 2. Name Memory (`rememberUserName`)
- Detects when user introduces themselves
- Stores name in Durable Objects SQL
- Personalizes future greetings

### 3. Document Downloads (`sendDocumentReply`)
- Allows users to request full CV or cover letter
- Returns markdown link to download endpoint
- Can be extended to serve actual file downloads

### 4. Session Persistence
- Cookie-based sessions with 7-day expiry
- Each user gets their own Durable Object instance
- Conversation history persists across page refreshes
- Users can manually clear history via UI

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Vectorize Index
```bash
npx wrangler vectorize create personal-cv-index --dimensions=768 --metric=cosine
```

### 3. Deploy Worker
```bash
npm run deploy
```

### 4. Ingest Documents
See `setup-documents.md` for detailed instructions on uploading your CV and cover letter.

### 5. Test Locally
```bash
npm start
```

## 🔐 Security Considerations

### Implemented
- ✅ HttpOnly cookies (prevents XSS attacks)
- ✅ Secure flag (HTTPS only)
- ✅ SameSite=Strict (prevents CSRF)
- ✅ Cryptographically secure session IDs
- ✅ Per-user data isolation via Durable Objects

### Production Recommendations
- 🔒 Protect `/admin/ingest` endpoint with authentication
- 🔒 Consider rate limiting for chat endpoint
- 🔒 Use Cloudflare Access for admin routes
- 🔒 Monitor for abuse via Cloudflare Analytics

## 💬 Sample Interactions

**Recruiter**: "Hi, I'm Sarah from Cloudflare"  
**Bot**: "Great to meet you, Sarah! I'll remember your name..."

**Recruiter**: "What experience does Jules have with Python?"  
**Bot**: *[Uses RAG tool to search CV]* "Based on Jules' CV..."

**Recruiter**: "Can I see your full CV?"  
**Bot**: "I can provide Jules' CV. [Download CV](/api/download/cv)"

**Recruiter**: *[Returns next week]*  
**Bot**: "Welcome back, Sarah! Great to hear from you again."

## 🧪 Testing Checklist

- [ ] Cookie persists across page refreshes
- [ ] Different browser tabs get different sessions (incognito mode)
- [ ] Vectorize returns relevant CV content for queries
- [ ] User name is remembered across sessions
- [ ] Llama 3.3 responds in appropriate tone
- [ ] No OpenAI dependencies remain
- [ ] Only 3 tools available: queryPersonalInfo, rememberUserName, sendDocumentReply

## 📊 Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript |
| Backend | Cloudflare Workers |
| LLM | Llama 3.3 (Workers AI) |
| Vector DB | Vectorize |
| State | Durable Objects SQL |
| Auth | Cookie-based sessions |

## 🎨 UI Changes

- Updated title: "Chat with Jules"
- Personalized welcome message
- Listed chatbot capabilities (ask questions, request documents, remember names)
- Privacy notice about conversation persistence
- Removed OpenAI key warnings

## 🔄 Data Flow

1. User visits → Cookie checked → Session ID created/retrieved
2. Session ID → Maps to Durable Object instance
3. User sends message → Stored in DO SQL
4. Message → Llama 3.3 processes
5. If specific question → RAG tool queries Vectorize
6. Response streamed back to user
7. Conversation persists in DO SQL for future sessions

## 📝 Environment Variables

No environment variables required! Everything runs on Cloudflare's platform:
- ✅ Workers AI (no API key needed)
- ✅ Vectorize (bound via wrangler.jsonc)
- ✅ Durable Objects (automatic)

## 🚧 Future Enhancements

- [ ] Actual PDF/DOCX download endpoints
- [ ] Admin dashboard for viewing analytics
- [ ] Multi-language support
- [ ] Voice chat integration
- [ ] More sophisticated RAG with re-ranking
- [ ] Export conversation transcripts
- [ ] Integration with calendar for scheduling interviews

## 📞 Support

For questions about this implementation, the chatbot can help recruiters learn about Jules' background, availability, and qualifications. Just start chatting!
