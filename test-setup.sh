#!/bin/bash

# Test Setup Script for Personal Chatbot
# This script helps you verify the setup is working correctly

echo "🧪 Personal Chatbot - Test Setup"
echo "================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "   Install with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"
echo ""

# Check if vectorize index exists
echo "📊 Checking Vectorize index..."
if wrangler vectorize list | grep -q "personal-cv-index"; then
    echo "✅ Vectorize index 'personal-cv-index' exists"
else
    echo "⚠️  Vectorize index not found. Creating it..."
    wrangler vectorize create personal-cv-index --dimensions=768 --metric=cosine
    if [ $? -eq 0 ]; then
        echo "✅ Vectorize index created successfully"
    else
        echo "❌ Failed to create Vectorize index"
        exit 1
    fi
fi
echo ""

# Check if example document file exists
if [ -f "my-documents.json" ]; then
    echo "✅ Found my-documents.json"
    echo ""
    echo "📤 Would you like to ingest your documents now?"
    echo "   This will upload your CV and cover letter to Vectorize."
    echo ""
    read -p "   Deploy and ingest? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Deploying worker..."
        npm run deploy
        
        if [ $? -eq 0 ]; then
            echo "✅ Worker deployed"
            echo ""
            echo "📤 Ingesting documents..."
            
            # Get the deployed URL from wrangler
            WORKER_URL=$(wrangler deployments list --limit 1 | grep -oE 'https://[^ ]+' | head -1)
            
            if [ -z "$WORKER_URL" ]; then
                echo "⚠️  Could not auto-detect worker URL"
                echo "   Please manually ingest using:"
                echo "   curl -X POST https://your-worker.workers.dev/admin/ingest \\"
                echo "        -H 'Content-Type: application/json' \\"
                echo "        -d @my-documents.json"
            else
                curl -X POST "$WORKER_URL/admin/ingest" \
                    -H "Content-Type: application/json" \
                    -d @my-documents.json
                
                if [ $? -eq 0 ]; then
                    echo ""
                    echo "✅ Documents ingested successfully"
                else
                    echo ""
                    echo "❌ Failed to ingest documents"
                fi
            fi
        else
            echo "❌ Failed to deploy worker"
        fi
    fi
else
    echo "⚠️  No my-documents.json found"
    echo ""
    echo "📝 Create my-documents.json with your CV and cover letter:"
    echo ""
    cat << 'EOF'
{
  "cv": "Your full CV text here...",
  "coverLetter": "Your cover letter text here..."
}
EOF
    echo ""
    echo "   See setup-documents.md for more details"
fi

echo ""
echo "🎉 Setup check complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure my-documents.json contains your CV and cover letter"
echo "   2. Run 'npm start' to test locally"
echo "   3. Run 'npm run deploy' to deploy to production"
echo "   4. Test the chatbot by asking about your experience"
echo ""
echo "💡 Test questions to try:"
echo "   - 'Hi, I'm Sarah from Cloudflare'"
echo "   - 'What experience does Jules have with Python?'"
echo "   - 'Can you send me your CV?'"
echo "   - 'When is Jules available for an internship?'"
echo ""
