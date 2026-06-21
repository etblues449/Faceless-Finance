---
description: Deploy sub-agents to analyze requirements and create a comprehensive project plan
argument-hint: describe your project goals and requirements
allowed-tools: claude-web-search, code-execution, file-operations
---
# Ultra Plan Generator
Use this command when you need to create a detailed project plan with broken-down tasks, timelines, and resource allocation across multiple specialized sub-agents.
## How It Works
1. **Receives your project brief** - You provide the overall goals and constraints
2. **Deploys specialized sub-agents** - Each handles a specific planning domain:
   - Technical Architecture Agent
   - Timeline & Milestones Agent
   - Resource Allocation Agent
   - Risk Assessment Agent
3. **Synthesizes plans** - Combines all sub-agent outputs into a cohesive ultra-plan
4. **Outputs structured plan** - Deliverable in markdown/JSON with Gantt chart, dependencies, and critical path
## Best Used For
- Large software projects
- Product launches
- Cross-functional initiatives
- Planning with uncertainty
Use `/goal` after this to execute against the plan iteratively.
