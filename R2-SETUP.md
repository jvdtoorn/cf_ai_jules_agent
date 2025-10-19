# R2 Document Storage Setup

This project stores the system prompt and documents (CV, cover letter) in Cloudflare R2.

## Initial Setup

### 1. Enable R2 in Cloudflare Dashboard
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 Object Storage
3. Enable R2 for your account (if not already enabled)

### 2. Create the R2 Bucket
```bash
npx wrangler r2 bucket create documents
```

### 3. Prepare Your Documents
Create the following files in the `data/` directory:

- `data/system-prompt.txt` - Your personalized system prompt (use `system-prompt.example.txt` as a template)
- `data/resume.pdf` - Your resume/CV in PDF format
- `data/cover-letter.pdf` - Your cover letter in PDF format

**Note:** These files are gitignored and will not be committed to the repository. See `data/README.md` for more details.

### 4. Upload Documents to R2
```bash
npm run upload-docs
```

This will upload all three files to your R2 bucket.

## Updating Documents

Whenever you update your system prompt, resume, or cover letter:

1. Edit the local files in the `data/` directory (`data/system-prompt.txt`, `data/resume.pdf`, `data/cover-letter.pdf`)
2. Run `npm run upload-docs` to upload the changes to R2
3. Deploy your worker: `npm run deploy`

The system prompt is cached in memory, so you may need to wait for the worker to restart or clear the cache for changes to take effect.

## Document Access

- **System Prompt**: Automatically fetched by the agent on first message
- **Resume/CV**: Accessible at `/api/download/cv`
- **Cover Letter**: Accessible at `/api/download/cover_letter`

## Template Variables

The system prompt supports the following template variables:

- `{{AGE}}` - Automatically calculated from birthdate in the code

## Troubleshooting

If documents aren't loading:
1. Verify R2 is enabled in your Cloudflare account
2. Check that the bucket was created: `npx wrangler r2 bucket list`
3. Verify files were uploaded: `npx wrangler r2 object list documents`
4. Check worker logs for errors: `npx wrangler tail`

## Manual Upload (Alternative)

You can also upload files manually using wrangler:

```bash
# Upload system prompt
npx wrangler r2 object put documents/system-prompt.txt --file="data/system-prompt.txt"

# Upload resume
npx wrangler r2 object put documents/resume.pdf --file="data/resume.pdf"

# Upload cover letter
npx wrangler r2 object put documents/cover-letter.pdf --file="data/cover-letter.pdf"
```
