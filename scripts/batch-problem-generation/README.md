# Batch Problem Generation

Efficient batch processing system for generating LeetCode problems using Claude's Batch API with 50% cost savings.

## Overview

This system replaces the real-time problem generation API with a batch-based workflow that:
- Generates problem data using Claude's Batch API (50% discount)
- Verifies test cases with Judge0
- Uploads verified problems to Firestore
- Handles hundreds of problems efficiently

## Architecture

```
scripts/batch-problem-generation/
├── batch-prompt-generator.ts    # Step 1: Generate batch prompts
├── batch-job-manager.ts         # Step 2: Submit, monitor, process
├── types.ts                     # Shared TypeScript types
├── utils.ts                     # Shared utility functions
├── input/
│   └── problems.txt             # Input: LeetCode problem URLs
└── output/
    ├── batch-prompts/           # Generated JSONL files
    ├── batch-jobs/              # Job metadata (JSON)
    └── batch-results/           # Downloaded results (JSONL)
```

## Prerequisites

1. **Environment Variables**:
   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   JUDGE0_API_KEY=your_judge0_key
   JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
   ```

2. **Firebase Admin SDK**: Configured in your project

3. **Dependencies**: Already installed via `package.json`

## Quick Start

### 1. Prepare Input File

Create `input/problems.txt` with LeetCode problem slugs (one per line):

```
# Recommended format: just the slug
two-sum
add-two-numbers
longest-substring-without-repeating-characters

# Comments are supported
median-of-two-sorted-arrays

# Full URLs also work (but slugs are preferred)
https://leetcode.com/problems/trapping-rain-water/
```

**Supported formats:**
- **Slug only** (recommended): `two-sum`
- **Full URL** (also works): `https://leetcode.com/problems/two-sum/`

### 2. Generate Batch Prompts

```bash
npx tsx scripts/batch-problem-generation/batch-prompt-generator.ts
```

**What it does:**
- Reads problem slugs from `input/problems.txt`
- **Automatically checks Firestore** for existing problems
- Filters out problems that already exist (saves API costs!)
- Creates `output/batch-prompts/batch_001.jsonl` (and more if > 10,000 problems)
- Shows summary with existing vs. new problems

**Optional flags:**
```bash
# Force regeneration of existing problems (skip Firestore check)
npx tsx scripts/batch-problem-generation/batch-prompt-generator.ts --skip-existing-check
# OR
npx tsx scripts/batch-problem-generation/batch-prompt-generator.ts --force
```

### 3. Submit Batch Jobs

```bash
npx tsx scripts/batch-problem-generation/batch-job-manager.ts submit
```

**What it does:**
- Uploads JSONL files to Claude API
- Creates batch jobs
- Saves metadata to `output/batch-jobs/batch_XXX_metadata.json`
- Shows batch IDs and initial status

### 4. Check Status

```bash
npx tsx scripts/batch-problem-generation/batch-job-manager.ts status
```

**What it does:**
- Queries Claude API for job status
- Updates metadata files
- Shows processing progress (succeeded/errored/processing counts)
- Marks completed jobs

**Tip:** Run periodically until jobs complete (usually 24 hours for large batches)

### 5. Process Results

```bash
npx tsx scripts/batch-problem-generation/batch-job-manager.ts process
```

**What it does:**
- Downloads results from Claude API
- Parses problem data from responses
- Verifies test cases with Judge0
- Uploads verified problems to Firestore
- Shows detailed summary with success/failure counts

### All-in-One Command

```bash
npx tsx scripts/batch-problem-generation/batch-job-manager.ts run
```

Executes submit → status → process sequentially.

## Workflow Details

### Batch Prompt Generator

**Input:** `input/problems.txt`

**Process:**
1. Reads problem URLs
2. Extracts slugs using `extractSlugFromUrl`
3. Generates prompts using `getProblemDataGenerationPrompt`
4. Formats as Claude Batch API requests:
   ```json
   {
     "custom_id": "two-sum",
     "method": "POST",
     "url": "/v1/messages",
     "body": {
       "model": "claude-3-7-sonnet-20250219",
       "max_tokens": 16384,
       "thinking": {"type": "enabled", "budget_tokens": 8192},
       "system": "You are a specialized data generator...",
       "messages": [{"role": "user", "content": "Generate..."}]
     }
   }
   ```
5. Splits into files (max 10,000 requests per file)

**Output:** `output/batch-prompts/batch_XXX.jsonl`

### Batch Job Manager

#### Submit Phase

**Input:** JSONL files from `output/batch-prompts/`

**Process:**
1. Discovers unsubmitted batch files
2. Calls `anthropic.messages.batches.create()`
3. Creates metadata file:
   ```json
   {
     "batch_id": "msgbatch_...",
     "batch_name": "batch_001",
     "status": "in_progress",
     "request_count": 50,
     "created_at": "2025-01-15T10:30:00Z"
   }
   ```

**Output:** `output/batch-jobs/batch_XXX_metadata.json`

#### Status Phase

**Input:** Metadata files from `output/batch-jobs/`

**Process:**
1. Loads all active job metadata
2. Calls `anthropic.messages.batches.retrieve(batch_id)`
3. Updates status and request counts
4. Marks completed jobs

**Output:** Updated metadata files

#### Process Phase

**Input:** Completed job metadata

**Process:**
1. Downloads results via `anthropic.messages.batches.results()`
2. Saves to `output/batch-results/batch_XXX_results.jsonl`
3. For each result:
   - Parses problem data using `parseAndProcessProblemData`
   - Verifies test cases with Judge0:
     - Creates submissions with optimized solution
     - Polls for results
     - Validates all test cases pass
   - Uploads verified problems to Firestore
4. Updates metadata with processing results

**Output:**
- `output/batch-results/batch_XXX_results.jsonl`
- Problems uploaded to Firestore collection `problems`
- Updated metadata with results summary

## File Formats

### Input File (`input/problems.txt`)

```
https://leetcode.com/problems/two-sum/
https://leetcode.com/problems/add-two-numbers/
# Lines starting with # are comments
# Empty lines are ignored
```

### Batch Prompt File (`output/batch-prompts/batch_001.jsonl`)

Each line is a JSON object:
```json
{"custom_id":"two-sum","method":"POST","url":"/v1/messages","body":{...}}
{"custom_id":"add-two-numbers","method":"POST","url":"/v1/messages","body":{...}}
```

### Batch Metadata (`output/batch-jobs/batch_001_metadata.json`)

```json
{
  "batch_id": "msgbatch_01J123ABC...",
  "batch_name": "batch_001",
  "prompt_file": "output/batch-prompts/batch_001.jsonl",
  "status": "completed",
  "request_count": 50,
  "created_at": "2025-01-15T10:30:00Z",
  "last_checked": "2025-01-15T22:15:00Z",
  "completed_at": "2025-01-15T22:00:00Z",
  "request_counts": {
    "processing": 0,
    "succeeded": 48,
    "errored": 2,
    "canceled": 0,
    "expired": 0
  },
  "results": {
    "total_processed": 48,
    "successfully_verified": 45,
    "verification_failed": 3,
    "uploaded_to_firestore": 45
  }
}
```

### Batch Results (`output/batch-results/batch_001_results.jsonl`)

Each line is a Claude API result:
```json
{"custom_id":"two-sum","result":{"type":"succeeded","message":{"content":[{"type":"text","text":"{...problem data...}"}]}}}
```

## Error Handling

### Invalid URLs
- Skipped with warning in prompt generator
- Listed in console output

### Parsing Failures
- Logged with error details
- Problem skipped, processing continues
- Tracked in metadata results

### Verification Failures
- Test case failures logged
- Problem not uploaded to Firestore
- Error details in metadata

### Network Failures
- Automatic retries with exponential backoff
- Status persistence in metadata files
- Resume from last checkpoint

## Monitoring

### Check Job Progress

```bash
# Quick status check
npx tsx scripts/batch-problem-generation/batch-job-manager.ts status

# Watch mode (check every 5 minutes)
watch -n 300 'npx tsx scripts/batch-problem-generation/batch-job-manager.ts status'
```

### View Metadata

```bash
# Pretty print metadata
cat output/batch-jobs/batch_001_metadata.json | jq
```

### Check Results

```bash
# Count results
wc -l output/batch-results/batch_001_results.jsonl

# View first result
head -1 output/batch-results/batch_001_results.jsonl | jq
```

## Troubleshooting

### Problem: "No batch files found"

**Solution:** Run the prompt generator first:
```bash
npx tsx scripts/batch-problem-generation/batch-prompt-generator.ts
```

### Problem: "Anthropic API error"

**Solution:** Check your API key:
```bash
echo $ANTHROPIC_API_KEY
```

### Problem: "Judge0 verification failed"

**Causes:**
- Incorrect test cases generated by AI
- Solution code doesn't match test cases
- Judge0 API timeout

**Solution:** Check individual problem in results file and validate manually

### Problem: "Batch stuck in 'in_progress'"

**Solution:** Claude batches can take up to 24 hours. Check periodically:
```bash
npx tsx scripts/batch-problem-generation/batch-job-manager.ts status
```

## Best Practices

1. **Start Small**: Test with 5-10 problems first
2. **Monitor Progress**: Check status every few hours
3. **Review Results**: Validate a few problems manually
4. **Backup Metadata**: Keep metadata files for audit trail
5. **Rate Limits**: Don't submit too many batches simultaneously

## Cost Estimation

- Claude Batch API: **50% discount** vs real-time
- Example: 100 problems = ~$5 (vs $10 real-time)
- Judge0 verification: Included in your RapidAPI plan

## Comparison with Old System

| Feature | Old API Route | New Batch System |
|---------|--------------|------------------|
| Cost | $10 per 100 problems | $5 per 100 problems |
| Rate Limits | Real-time throttling | No throttling |
| Scalability | ~50 problems max | Thousands |
| Monitoring | None | Full metadata tracking |
| Resumability | No | Yes (checkpoint-based) |
| Verification | Same (Judge0) | Same (Judge0) |

## Migration from Old System

The old API route at `/app/api/problem/import-batch/route.ts` is now deprecated. To migrate:

1. Stop using the old API endpoint
2. Use this batch system instead
3. Remove the old API route after confirming batch system works

## Support

For issues or questions:
1. Check this README
2. Review metadata files for error details
3. Check console logs for detailed error messages
4. Validate individual problems in Firestore

## License

Same as parent project.
