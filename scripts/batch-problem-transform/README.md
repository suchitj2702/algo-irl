# Batch Problem Transformation

TypeScript-based batch processing system for generating problem transformations using OpenAI's Batch API. This system creates company-specific, role-enhanced problem scenarios at scale with **50% cost savings** compared to real-time API calls.

## Overview

This batch system generates transformation prompts for all combinations of:
- **Problems** (from Firestore)
- **Companies** (from Firestore)
- **Roles** (5 engineering role families)

**Example**: 10 problems × 5 companies × 5 roles = **250 transformations**

All transformations are automatically saved to the Firestore transformation cache for instant retrieval by the API.

## Architecture

The system consists of three phases:

1. **Phase 1: Generate Prompts** (`batch-prompt-generator.ts`)
   - Reads problem and company IDs from input files
   - Fetches data from Firestore
   - Generates role-enhanced transformation prompts
   - Creates OpenAI Batch API format JSONL files

2. **Phase 2: Submit Jobs** (`batch-job-manager.ts submit`)
   - Uploads JSONL files to OpenAI Files API
   - Creates batch jobs via OpenAI Batches API
   - Tracks job metadata locally

3. **Phase 3: Process Results** (`batch-job-manager.ts process`)
   - Downloads completed batch results
   - Parses scenarios into structured sections
   - Saves to Firestore transformation cache

## Directory Structure

```
scripts/batch-problem-transform/
├── README.md                           # This file
├── load-env.ts                         # Environment variable loader
├── types.ts                            # TypeScript type definitions
├── utils.ts                            # Shared utilities
├── batch-prompt-generator.ts           # Phase 1 script
├── batch-job-manager.ts                # Phase 2 & 3 script
├── input/                              # Input files (user-created)
│   ├── problems.txt                    # Problem IDs (one per line)
│   └── companies.txt                   # Company IDs (one per line)
└── output/                             # Generated files (git-ignored)
    ├── batch_prompts/                  # JSONL prompt files
    │   └── batch_001_YYYYMMDD_HHMMSS.jsonl
    ├── batch_jobs/                     # Job metadata
    │   └── batch_001_YYYYMMDD_HHMMSS_metadata.json
    └── batch_results/                  # Downloaded results
        └── batch_001_YYYYMMDD_HHMMSS_results.jsonl
```

## Setup

### Prerequisites

1. **OpenAI API Key** with Batch API access
2. **Firestore Database** with problems and companies
3. **Node.js** (v18 or higher)

### Environment Variables

Add your OpenAI API key to `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-proj-...
```

### Input Files

Create input files specifying which problems and companies to process:

**`input/problems.txt`**:
```
two-sum
three-sum
valid-parentheses
merge-k-sorted-lists
```

**`input/companies.txt`**:
```
google
meta
amazon
netflix
stripe
```

Lines starting with `#` are treated as comments and ignored.

## Usage

### Quick Start (All Phases)

Run all phases sequentially:

```bash
npx tsx scripts/batch-problem-transform/batch-job-manager.ts run
```

This will:
1. Submit any unsubmitted batch files
2. Check status of active jobs
3. Process any completed results

### Phase-by-Phase Workflow

#### 1. Generate Prompts

```bash
npx tsx scripts/batch-problem-transform/batch-prompt-generator.ts
```

**What it does**:
- Reads `input/problems.txt` and `input/companies.txt`
- Fetches problems and companies from Firestore
- Generates transformation prompts for all combinations × 5 roles
- Creates JSONL files in `output/batch_prompts/`
- Automatically splits into multiple files if > 50,000 requests

**Output**:
```
✅ Successfully generated 250 prompts
✅ Created batch_001_20250103_143022.jsonl with 250 requests
```

#### 2. Submit to OpenAI

```bash
npx tsx scripts/batch-problem-transform/batch-job-manager.ts submit
```

**What it does**:
- Discovers unsubmitted JSONL files in `output/batch_prompts/`
- Uploads each file to OpenAI Files API
- Creates batch jobs via OpenAI Batches API
- Saves metadata to `output/batch_jobs/`

**Output**:
```
✅ Submitting batch: batch_001_20250103_143022
  File uploaded: file-abc123
  Batch ID: batch_xyz789
  Status: validating
  Metadata saved
```

#### 3. Check Status

```bash
npx tsx scripts/batch-problem-transform/batch-job-manager.ts status
```

**What it does**:
- Checks status of all active batch jobs
- Updates metadata with current progress
- Shows completion percentage

**Output**:
```
Status Summary:
  completed: 2
  in_progress: 1
  validating: 0
```

**Batch Lifecycle**:
- `validating` → `in_progress` → `finalizing` → `completed`
- Batches typically complete within **24 hours**

#### 4. Process Results

```bash
npx tsx scripts/batch-problem-transform/batch-job-manager.ts process
```

**What it does**:
- Downloads results from completed jobs
- Parses scenarios into structured sections
- Saves to Firestore transformation cache
- Stores results locally in `output/batch_results/`

**Output**:
```
✅ Processing batch: batch_001_20250103_143022
  Results saved to: batch_001_20250103_143022_results.jsonl
  Successfully cached: 248/250
  Failed: 2
```

## Cost Savings

OpenAI Batch API provides **50% discount** on API costs:

| Processing Method | Cost per 1M tokens | Cost for 250 transformations* |
|-------------------|-------------------|-------------------------------|
| Real-time API     | $5.00             | ~$12.50                      |
| Batch API         | $2.50             | ~$6.25                       |
| **Savings**       | **50%**           | **$6.25**                    |

*Assuming ~10K tokens per transformation (input + output)

## Advanced Usage

### Custom Model

Edit `batch-prompt-generator.ts` to use a fine-tuned model:

```typescript
const OPENAI_MODEL = 'ft:gpt-4o-2024-08-06:your-org:model-name:abc123';
```

### Filtering Input

Use comments in input files to disable specific items:

```
# Active problems
two-sum
three-sum

# Temporarily disabled
# hard-problem-1
# hard-problem-2
```

### Re-generating Existing Transformations

By default, the system generates prompts for all input combinations. To regenerate transformations that already exist in cache, simply re-run the generator - the batch system will overwrite the cache entries when processing results.

### Monitoring Long-Running Jobs

For large batches, create a monitoring script:

```bash
# Check status every 30 minutes
while true; do
  npx tsx scripts/batch-problem-transform/batch-job-manager.ts status
  sleep 1800
done
```

## Troubleshooting

### Error: "OPENAI_API_KEY is not set"

**Solution**: Add your API key to `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-...
```

### Error: "No unsubmitted batch files found"

**Solution**: Run the prompt generator first:
```bash
npx tsx scripts/batch-problem-transform/batch-prompt-generator.ts
```

### Error: "Problem not found: problem-id"

**Solution**: Ensure the problem exists in Firestore. Check the problem ID spelling.

### Low Cache Success Rate

If many results fail to cache (e.g., 100/250 successful):

1. **Check parsing errors**: Review the error output for parsing issues
2. **Verify response format**: Ensure the model is generating valid scenarios
3. **Review custom IDs**: Ensure problem/company IDs are correct

### Batch Stuck in "validating" Status

**Normal**: Validation can take 1-2 hours for large batches
**Action**: Wait and check again later

### Batch Failed

**Check**: Review the batch status on OpenAI dashboard
**Common causes**:
- Invalid JSONL format (shouldn't happen with our generator)
- File upload timeout (retry submission)
- API quota exceeded (check your account limits)

## Technical Details

### Custom ID Format

Each transformation request has a unique custom ID:

```
Format: {problemId}_{companyId}_{roleFamily}_{6-digit-index}
Example: two-sum_google_backend_000001
```

This allows mapping results back to the correct problem/company/role combination.

### OpenAI Batch API Limits

- **Max requests per batch**: 50,000
- **Completion window**: 24 hours
- **Max file size**: 200 MB
- **Batch expiration**: 30 days

### Role Families

All transformations are generated for 5 engineering roles:

1. `backend` - Backend & Systems Engineering
2. `ml` - ML & Data Engineering
3. `frontend` - Frontend & Full-Stack Engineering
4. `infrastructure` - Infrastructure & Platform Engineering
5. `security` - Security & Reliability Engineering

### Transformation Cache

Results are saved to Firestore at:
```
transformations/{problemId}__{companyId}__{roleFamily}
```

This matches the cache structure used by the real-time transformation API.

## Example Workflow

### Generate 500 Transformations

```bash
# 1. Create input files
cat > scripts/batch-problem-transform/input/problems.txt <<EOF
two-sum
three-sum
valid-parentheses
merge-k-sorted-lists
longest-substring
reverse-linked-list
binary-tree-inorder
max-depth-binary-tree
word-search
clone-graph
EOF

cat > scripts/batch-problem-transform/input/companies.txt <<EOF
google
meta
amazon
netflix
stripe
uber
airbnb
microsoft
apple
tesla
EOF

# 2. Generate prompts (10 problems × 10 companies × 5 roles = 500)
npx tsx scripts/batch-problem-transform/batch-prompt-generator.ts

# 3. Submit to OpenAI
npx tsx scripts/batch-problem-transform/batch-job-manager.ts submit

# 4. Wait 12-24 hours...

# 5. Check status
npx tsx scripts/batch-problem-transform/batch-job-manager.ts status

# 6. Process results (once completed)
npx tsx scripts/batch-problem-transform/batch-job-manager.ts process
```

**Result**: 500 role-enhanced transformations cached and ready for instant API retrieval!

## Related Documentation

- [OpenAI Batch API Documentation](https://platform.openai.com/docs/guides/batch)
- [Problem Transformer Architecture](../../lib/problem/problemTransformer.ts)
- [Role-Enhanced Prompts](../../lib/problem/prompt/rolePromptGenerator.ts)
- [Transformation Cache](../../lib/problem/transformCacheUtils.ts)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the TypeScript files for inline documentation
3. Check OpenAI API status: https://status.openai.com/
