# Document Setup Guide

This guide explains how to set up your personal documents (CV and cover letter) for the chatbot.

## Step 1: Create the Vectorize Index

First, you need to create the Vectorize index in Cloudflare:

```bash
npx wrangler vectorize create personal-cv-index --dimensions=768 --metric=cosine
```

This creates a vector database index that can store embeddings of your CV and cover letter.

## Step 2: Deploy the Worker

Deploy your worker so the ingestion endpoint is available:

```bash
npm run deploy
```

## Step 3: Ingest Your Documents

Create a file called `my-documents.json` with your CV and cover letter:

```json
{
  "cv": "Your full CV text here. Include all your work experience, education, skills, etc.",
  "coverLetter": "Your cover letter text here. Include why you want the internship, your availability, etc."
}
```

Then use curl to ingest the documents:

```bash
curl -X POST https://your-worker-url.workers.dev/admin/ingest \
  -H "Content-Type: application/json" \
  -d @my-documents.json
```

Or locally during development:

```bash
curl -X POST http://localhost:8787/admin/ingest \
  -H "Content-Type: application/json" \
  -d @my-documents.json
```

## Example Document Format

Here's a template for your documents:

```json
{
  "cv": "Jules [Last Name]\n\nEducation:\n- University Name, Degree Program, Expected Graduation\n- Relevant coursework: List your courses\n\nExperience:\n- Company Name, Position, Dates\n  • Achievement 1\n  • Achievement 2\n\nSkills:\n- Programming Languages: Python, JavaScript, TypeScript, etc.\n- Technologies: React, Node.js, Cloudflare Workers, etc.\n\nProjects:\n- Project 1: Description\n- Project 2: Description",
  
  "coverLetter": "Dear Hiring Manager,\n\nI am writing to express my interest in the Summer Internship position at Cloudflare...\n\nAvailability: [Your availability dates]\n\nWhy Cloudflare: [Your reasons]...\n\nBest regards,\nJules"
}
```

## Security Note

⚠️ **Important**: The `/admin/ingest` endpoint should be protected in production. Consider:
- Adding authentication (API key, OAuth, etc.)
- Restricting access by IP address
- Removing the endpoint after initial setup
- Using Cloudflare Access to protect the endpoint

## Verification

After ingesting, test the chatbot by asking questions like:
- "What experience does Jules have with Python?"
- "Tell me about Jules' education"
- "What are Jules' main skills?"

The RAG system should retrieve relevant information from your documents.
