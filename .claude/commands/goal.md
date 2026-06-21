---
description: Execute iteratively against a plan, verifying progress with gated advancement
argument-hint: describe the current task and desired outcome
allowed-tools: claude-web-search, code-execution, file-operations
---
# Goal Loop Executor
Implements a verify-gated execution loop where you work toward a goal while systematically verifying completion at each step.
## How It Works
1. **Receives goal statement** - You describe what you want to accomplish
2. **Autonomous execution phase** - Breaks goal into steps and executes them
3. **Verification gate** - After each step, verifies completion against success criteria
4. **Gated advancement** - Only proceeds to next step if verification passes
5. **Iteration** - Loops until goal is fully achieved
6. **Delivers result** - Produces final deliverable with verification evidence
## Best Used For
- Incremental feature development
- Bug fixes with test verification
- Data processing pipelines
- Quality-gated workflows
