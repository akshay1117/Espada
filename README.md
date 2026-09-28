# Orbit — AI career mentor

> **Aim:** Build an AI mentor that analyzes a student's current skills against their career goal and suggests a personalized, achievable learning path—with sequenced milestones, useful resources, and a schedule that fits their available study time.

Orbit is a web app for the college hackathon prompt. The browser app is static; the live Groq chat runs through a small Vercel serverless endpoint so the secret key stays server-side.

## What the AI agent does

- The **local planner** analyzes skill confidence, identifies gaps, sequences role milestones, matches curated resources, creates a study schedule, and validates the roadmap. Its six tool calls are visible in **Agent Tool Trace**.
- The **Groq-powered mentor chat** uses function calling through `api/chat.js`. It can update weekly hours, update a skill-confidence level, retrieve the next milestone, and return a curated resource. Tool calls are displayed under the response.
- If the API is unavailable, the chat falls back to the local mentor. The roadmap remains usable without a key.

## Run locally with Groq

1. Create a Groq API key in your Groq account. Never paste it into browser code, chat, or GitHub.
2. Copy `.env.example` to `.env.local` and put the key in that local file:

```bash
cp .env.example .env.local
```

Set `GROQ_API_KEY` to your key. The default `GROQ_MODEL` is `openai/gpt-oss-20b`; change it only to a model available to your account.
3. Run the Vercel development server:

```bash
npm run dev
```

Open the local URL printed by Vercel. The browser calls `/api/chat`; the Vercel function calls Groq.

The API uses Groq's OpenAI-compatible Chat Completions endpoint and tool-use flow. See [Groq tool-use documentation](https://console.groq.com/docs/tool-use) and [supported models](https://console.groq.com/docs/models).

## Push to GitHub, then deploy on Vercel

GitHub Pages only hosts static files—it cannot run this API function or protect a model key. Keep the repository on GitHub, then deploy the same repo on Vercel for live AI chat.

1. Create an empty GitHub repository.
2. From the project folder, push the app (do **not** add `.env.local`):

```bash
git init
git add index.html agent.js api/chat.js package.json .env.example .gitignore README.md
git commit -m "Build Orbit AI career mentor"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If the folder already has a Git remote, skip `git init` and `git remote add origin`; use `git status` to check what will be committed.
3. In Vercel, choose **New Project → Import Git Repository**, select this repository, and deploy it.
4. In Vercel **Project Settings → Environment Variables**, add:
   - `GROQ_API_KEY` = your secret key
   - `GROQ_MODEL` = `openai/gpt-oss-20b`
5. Redeploy after adding the variables. Test **Ask Orbit** with “What should I learn first?”, “I know JavaScript,” and “Replan for 3 hours/week.” The chat badge should say **GROQ LIVE**.

**Do not deploy a real API key in GitHub Pages, `index.html`, `agent.js`, `.env.example`, or a public repository.** `.env.local` is ignored by `.gitignore`. If a key was ever committed, revoke/rotate it immediately.

## 45-second demo

1. Show the preloaded Frontend Developer plan and the six local planner tools in **Agent Tool Trace**.
2. Open **Ask Orbit** and ask “I know JavaScript.” Point out the Groq tool call and the updated plan.
3. Ask “Replan for 3 hours/week” and show the schedule update.
4. Ask “Why this roadmap?” or “What should I learn first?” to show contextual mentor answers.
5. Click **Data starter**, then mark a milestone complete and download the roadmap.

## Project files

- `index.html` — responsive app, planner UI, and chat client.
- `agent.js` — local skill-gap tools and fallback planner.
- `api/chat.js` — server-side Groq agent tools and secure endpoint.
- `.env.example` — safe placeholder configuration; contains no secret.
- `.gitignore` — excludes local env files and dependencies.
- `package.json` — local Vercel dev command.
