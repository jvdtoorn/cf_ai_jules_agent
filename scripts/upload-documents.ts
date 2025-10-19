#!/usr/bin/env tsx
/** Uploads documents from data/ directory to Cloudflare R2 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");
const DATA_DIR = join(ROOT_DIR, "data");

interface FileToUpload {
  fileName: string;
  r2Key: string;
  description: string;
}

const FILES_TO_UPLOAD: FileToUpload[] = [
  {
    fileName: "system-prompt.txt",
    r2Key: "system-prompt.txt",
    description: "System prompt with your CV and personality"
  },
  {
    fileName: "resume.pdf",
    r2Key: "resume.pdf",
    description: "Your resume/CV in PDF format"
  },
  {
    fileName: "cover-letter.pdf",
    r2Key: "cover-letter.pdf",
    description: "Your cover letter in PDF format"
  }
];

function checkAllFilesExist(): {
  allPresent: boolean;
  missing: FileToUpload[];
} {
  const missing: FileToUpload[] = [];

  for (const file of FILES_TO_UPLOAD) {
    const fullPath = join(DATA_DIR, file.fileName);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }

  return {
    allPresent: missing.length === 0,
    missing
  };
}

function uploadToR2(fileName: string, r2Key: string): void {
  const fullPath = join(DATA_DIR, fileName);
  console.log(`Uploading ${fileName} to R2...`);

  try {
    execSync(
      `npx wrangler r2 object put documents/${r2Key} --file="${fullPath}" --remote`,
      { cwd: ROOT_DIR, stdio: "inherit" }
    );
    console.log(`✓ Successfully uploaded ${fileName}`);
  } catch (error) {
    throw new Error(
      `Failed to upload ${fileName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function main() {
  console.log(
    "Cloudflare R2 Document Upload Tool\n==================================\n"
  );

  if (!existsSync(DATA_DIR)) {
    console.error("❌ Error: The data/ directory does not exist.\n");
    console.log(
      "Please create the data/ directory in the project root and add your documents.\n"
    );
    process.exit(1);
  }

  const { allPresent, missing } = checkAllFilesExist();

  if (!allPresent) {
    console.error("❌ Missing required files in data/ directory:\n");
    for (const file of missing) {
      console.error(`   • ${file.fileName} → ${file.description}`);
    }
    console.error("\nExpected files:");
    for (const file of FILES_TO_UPLOAD) {
      console.error(`   - data/${file.fileName}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log("✓ All required files found in data/ directory\n");
  console.log("Starting upload to R2...\n");

  let successCount = 0;
  let failCount = 0;

  for (const file of FILES_TO_UPLOAD) {
    try {
      uploadToR2(file.fileName, file.r2Key);
      successCount++;
    } catch (error) {
      console.error(
        `✗ ${error instanceof Error ? error.message : String(error)}`
      );
      failCount++;
    }
  }

  console.log(`\n==================================`);
  console.log(`Upload Summary: ✓ ${successCount} files uploaded successfully`);

  if (failCount > 0) {
    console.log(`  ✗ ${failCount} files failed`);
    process.exit(1);
  }

  console.log("\n✅ All documents uploaded successfully to R2!");
  console.log("You can now deploy your worker with: npm run deploy\n");
}

main();
