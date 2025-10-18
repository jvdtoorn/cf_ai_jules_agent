# 🚀 Quick Start Guide

Get your personal chatbot running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Cloudflare account ([sign up](https://dash.cloudflare.com/sign-up))
- [ ] Wrangler CLI authenticated (`npx wrangler login`)

## 5-Minute Setup

### 1️⃣ Install Dependencies (30 seconds)

```bash
npm install
```

### 2️⃣ Create Vectorize Index (30 seconds)

```bash
npx wrangler vectorize create personal-cv-index --dimensions=768 --metric=cosine
```

### 3️⃣ Prepare Your Documents (2 minutes)

```bash
# Copy the template
cp my-documents.example.json my-documents.json

# Edit my-documents.json with your information
# Replace placeholder text with your actual CV and cover letter
```

**Quick tip**: Keep it concise but informative. Focus on:
- Work experience & achievements
- Education & skills
- Projects
- Availability for internship
- Why you're interested in Cloudflare

### 4️⃣ Deploy (1 minute)

```bash
npm run deploy
```

Copy your worker URL from the output (looks like: `https://your-worker.your-subdomain.workers.dev`)

### 5️⃣ Ingest Documents (30 seconds)

```bash
curl -X POST https://YOUR-WORKER-URL/admin/ingest \
  -H "Content-Type: application/json" \
  -d @my-documents.json
```

Replace `YOUR-WORKER-URL` with your actual worker URL.

### 6️⃣ Test! (30 seconds)

Visit your worker URL and try:
- "Hi, I'm Sarah from Cloudflare"
- "What experience do you have with Python?"
- "Can you send me your CV?"

## ✅ Verification

You should see:
- ✅ Welcome message from Jules
- ✅ AI responds in first person
- ✅ Conversation history persists on refresh
- ✅ RAG returns information from your documents

## 🎨 Customization (Optional)

### Change the system prompt:
Edit `src/server.ts` around line 130

### Update UI branding:
Edit `src/app.tsx` around line 162 and 204

### Add more tools:
Edit `src/tools.ts`

## 🐛 Troubleshooting

### "Vectorize index not found"
```bash
npx wrangler vectorize list
# If empty, create the index again
npx wrangler vectorize create personal-cv-index --dimensions=768 --metric=cosine
```

### "No results from RAG"
- Ensure you ingested documents
- Check curl command succeeded (returns `{"success": true}`)
- Verify documents contain relevant text

### "Session not persisting"
- Check browser cookies are enabled
- Ensure HTTPS in production
- Clear cookies and try again

### "Workers AI error"
- Verify AI binding in `wrangler.jsonc`
- Check your Cloudflare plan includes Workers AI
- Review quotas in dashboard

## 📚 Next Steps

- [ ] Read [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details
- [ ] Review [TESTING.md](./TESTING.md) for comprehensive testing
- [ ] Customize the system prompt to match your personality
- [ ] Test with real recruiter-style questions
- [ ] Share your worker URL!

## 🔐 Security Reminder

⚠️ **Important**: The `/admin/ingest` endpoint is not protected by default.

For production:
1. Remove the endpoint after initial ingestion
2. Or add authentication (API key, OAuth, etc.)
3. Or use Cloudflare Access to protect it

## 💡 Tips for Success

1. **Be specific**: Include concrete examples in your CV
2. **Test thoroughly**: Ask the bot various questions
3. **Personalize**: Update the system prompt to sound like you
4. **Monitor**: Check Cloudflare dashboard for usage/errors
5. **Iterate**: Refine based on how the bot responds

## 📞 Need Help?

1. Check [TESTING.md](./TESTING.md) for troubleshooting
2. Review [IMPLEMENTATION.md](./IMPLEMENTATION.md) for architecture
3. Read [setup-documents.md](./setup-documents.md) for document setup
4. Check Cloudflare docs: https://developers.cloudflare.com/

## 🎉 You're Ready!

Your personal AI chatbot is now live and ready to impress recruiters!

**Share your worker URL with confidence** - it showcases:
- Modern web development skills
- AI/ML knowledge
- Cloudflare platform expertise
- Full-stack capabilities
- Security awareness

Good luck with your Cloudflare internship application! 🚀

---

**Estimated Total Setup Time**: 5 minutes  
**Difficulty Level**: Beginner-friendly  
**Cost**: Free tier should cover testing
