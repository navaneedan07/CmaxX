/**
 * seed.js
 * Seeds 3 realistic fake customer personas into Hindsight.
 * Run this ONCE after setting up your .env:
 *
 *   node seed.js
 *
 * This creates the "before/after" demo personas the judges will see.
 * Customer A = stateless (no memory seeded)
 * Customer B = "Sarah" — mid-journey, has a clear history
 * Customer C = "Raj"   — at-risk, two failed blockers
 */

import dotenv from 'dotenv';
dotenv.config();

import { HindsightClient } from '@vectorize-io/hindsight-client';

const client = new HindsightClient({
  baseUrl: process.env.HINDSIGHT_BASE_URL,
  apiKey: process.env.HINDSIGHT_API_KEY,
});

// ─── Helper ──────────────────────────────────────────────────────────────────
async function createBankIfNeeded(id, mission) {
  try {
    await client.createBank(id, {
      name: id,
      mission,
      disposition: { skepticism: 2, literalism: 3, empathy: 5 },
    });
    console.log(`✅ Created bank: ${id}`);
  } catch (err) {
    if (err.message?.includes('409') || err.message?.includes('already exists')) {
      console.log(`ℹ️  Bank already exists: ${id}`);
    } else {
      throw err;
    }
  }
}

async function retainBatch(bankId, items) {
  await client.retainBatch(bankId, items, { async: false });
  console.log(`   Retained ${items.length} memories into ${bankId}`);
}

// ─── Customer B: Sarah Mitchell ───────────────────────────────────────────────
async function seedSarah() {
  const id = 'cs-agent-customer-sarah';
  await createBankIfNeeded(id, `Memory bank for Sarah Mitchell, Operations Manager at TechFlow Inc.
  She bought the Team plan. Track her onboarding progress, goals, and blockers.`);

  await retainBatch(id, [
    {
      content: "Sarah's stated 30-day goal: get all 5 team members active and process the first 50 support tickets through the platform.",
      context: 'onboarding-day-1',
      metadata: { stage: 'onboarding', date: '2026-03-20' },
    },
    {
      content: "Sarah completed Step 1: created her account and set up the workspace. She's the admin.",
      context: 'onboarding-day-1',
      metadata: { stage: 'onboarding', date: '2026-03-20' },
    },
    {
      content: "Sarah tried the manual CSV import to bring in her ticket history. It failed — her CSV had a non-standard encoding (Windows-1252 instead of UTF-8). The import errored out. She was frustrated.",
      context: 'onboarding-day-3',
      metadata: { stage: 'onboarding', date: '2026-03-22', blocker: 'csv-encoding-error' },
    },
    {
      content: "We resolved Sarah's import blocker by using the API integration instead of CSV upload. She connected her Zendesk account via the integration panel and her 847 historical tickets imported successfully.",
      context: 'onboarding-day-3',
      metadata: { stage: 'onboarding', date: '2026-03-22', blockerResolved: 'csv-encoding-error' },
    },
    {
      content: "Sarah has onboarded 3 out of 5 team members so far. The remaining 2 are Tom and Priya — they haven't accepted their invites yet. Sarah mentioned they're on holiday this week.",
      context: 'adoption-day-7',
      metadata: { stage: 'adoption', date: '2026-03-27' },
    },
    {
      content: "Sarah's team has processed 31 tickets through the platform so far. She's 62% of the way to her 50-ticket goal. Health signal: engaged.",
      context: 'adoption-day-10',
      metadata: { stage: 'adoption', date: '2026-03-30', health: 'engaged' },
    },
    {
      content: "Sarah prefers async communication — she likes detailed written updates rather than calls. She's technically proficient and doesn't need hand-holding on UI steps.",
      context: 'customer-preferences',
      metadata: { preference: 'async', technicalLevel: 'high' },
    },
  ]);
}

// ─── Customer C: Raj Patel ────────────────────────────────────────────────────
async function seedRaj() {
  const id = 'cs-agent-customer-raj';
  await createBankIfNeeded(id, `Memory bank for Raj Patel, CTO at StartupX. 
  He bought the Starter plan. Solo user, evaluating before buying team seats. Track carefully.`);

  await retainBatch(id, [
    {
      content: "Raj's 30-day goal: build a working automation workflow that routes customer emails to the right department automatically, with no manual sorting.",
      context: 'onboarding-day-1',
      metadata: { stage: 'onboarding', date: '2026-03-15' },
    },
    {
      content: "Raj tried to set up the email routing rule using the Rules Engine. It didn't fire correctly — emails were going to the default inbox instead of the routing destinations. Spent 2 hours on this. Very frustrated.",
      context: 'onboarding-day-4',
      metadata: { stage: 'onboarding', date: '2026-03-19', blocker: 'rules-engine-not-firing' },
    },
    {
      content: "We suggested Raj check the trigger conditions in the Rules Engine. He tried re-saving the rule with corrected AND/OR logic but it still didn't work. The blocker is unresolved. He went quiet after this.",
      context: 'onboarding-day-5',
      metadata: { stage: 'onboarding', date: '2026-03-20', blocker: 'rules-engine-not-firing', health: 'going_quiet' },
    },
    {
      content: "Raj has not logged in for 8 days. Last session was 8 minutes. Health signal: at-risk. He mentioned in his last message he was 'thinking about switching to a simpler tool'.",
      context: 'health-signal',
      metadata: { stage: 'onboarding', health: 'at_risk', date: '2026-03-28', churnRisk: 'true' },
    },
    {
      content: "Raj is a developer — he's comfortable with APIs and webhooks. He mentioned he'd prefer a direct API approach if the UI tool is too complex. We should offer the webhook-based routing as an alternative to the Rules Engine UI.",
      context: 'customer-preferences',
      metadata: { technicalLevel: 'developer', preference: 'api' },
    },
  ]);
}

// ─── Customer: Priya Sharma ───────────────────────────────────────────────────
async function seedPriya() {
  const id = 'cs-agent-priya';
  await createBankIfNeeded(id, `Memory bank for Priya Sharma, Ops Manager. Goal: automate invoice processing.`);
  await retainBatch(id, [
    {
      content: "Priya's 30-day goal: automate invoice processing to reduce manual data entry by 80%.",
      context: 'onboarding-day-1',
      metadata: { stage: 'adoption', date: '2026-03-20' },
    },
    {
      content: 'Priya completed account setup, connected billing software, and processed first 10 invoices manually.',
      context: 'onboarding-day-2',
      metadata: { stage: 'adoption', date: '2026-03-21' },
    },
    {
      content: 'Priya tried manual CSV import — failed due to file format mismatch. Blocker unresolved.',
      context: 'adoption-day-3',
      metadata: { stage: 'adoption', date: '2026-04-08', blocker: 'csv-format-mismatch' },
    },
    {
      content: 'Priya tried converting the file to UTF-8 — CSV import still failed. Second attempt failed. Still blocked.',
      context: 'adoption-day-5',
      metadata: { stage: 'adoption', date: '2026-04-10', blocker: 'csv-format-mismatch', health: 'engaged' },
    },
    {
      content: 'Priya is an ops manager with a team of 4, very process-oriented, prefers step-by-step guidance.',
      context: 'customer-preferences',
      metadata: { preference: 'step-by-step', technicalLevel: 'medium' },
    },
  ]);
}

// ─── Customer: James Okafor ───────────────────────────────────────────────────
async function seedJames() {
  const id = 'cs-agent-james';
  await createBankIfNeeded(id, `Memory bank for James Okafor, Startup Founder. Goal: get all 8 team members onboarded.`);
  await retainBatch(id, [
    {
      content: "James's 30-day goal: get all 8 team members fully onboarded and using the platform daily.",
      context: 'onboarding-day-1',
      metadata: { stage: 'adoption', date: '2026-03-15' },
    },
    {
      content: 'James invited all 8 team members. 6 out of 8 completed profile setup. Team completed first training session.',
      context: 'adoption-day-4',
      metadata: { stage: 'adoption', date: '2026-04-05' },
    },
    {
      content: '2 team members are stuck on login — SSO error on their devices. Pending IT check on their end.',
      context: 'adoption-day-7',
      metadata: { stage: 'adoption', date: '2026-04-09', blocker: 'sso-error-2-members' },
    },
    {
      content: "James hasn't replied in 3 days. Health signal: going quiet. Last contact: said he'd follow up with IT.",
      context: 'health-signal',
      metadata: { stage: 'adoption', health: 'going_quiet', date: '2026-04-12' },
    },
    {
      content: 'James is a startup founder, moves fast, does not like long explanations. Needs short, direct responses.',
      context: 'customer-preferences',
      metadata: { preference: 'brief', technicalLevel: 'medium' },
    },
  ]);
}

// ─── Customer: Lisa Tran ──────────────────────────────────────────────────────
async function seedLisa() {
  const id = 'cs-agent-lisa';
  await createBankIfNeeded(id, `Memory bank for Lisa Tran, Enterprise customer. Goal: reduce support ticket volume by 30%.`);
  await retainBatch(id, [
    {
      content: "Lisa's 30-day goal: reduce support ticket volume by 30% within 30 days using automated responses.",
      context: 'onboarding-day-1',
      metadata: { stage: 'adoption', date: '2026-03-10' },
    },
    {
      content: 'Lisa set up automated response templates, integrated with Zendesk, trained the agent on top 20 FAQ topics, deployed to 40% of incoming tickets.',
      context: 'adoption-day-10',
      metadata: { stage: 'adoption', date: '2026-04-01' },
    },
    {
      content: "Lisa's ticket deflection is at 22% — 8% away from her 30% goal. She is very happy with progress and asked about expanding to more categories. Health signal: engaged.",
      context: 'adoption-day-15',
      metadata: { stage: 'adoption', health: 'engaged', date: '2026-04-10' },
    },
    {
      content: 'Lisa is an enterprise customer, data-driven, loves metrics. Responds well to specific numbers and clear next steps.',
      context: 'customer-preferences',
      metadata: { preference: 'data-driven', technicalLevel: 'high' },
    },
  ]);
}

// ─── Customer: David Chen ─────────────────────────────────────────────────────
async function seedDavid() {
  const id = 'cs-agent-david';
  await createBankIfNeeded(id, `Memory bank for David Chen, Senior Developer. Goal: full API integration with internal CRM.`);
  await retainBatch(id, [
    {
      content: "David's 30-day goal: build a full API integration between the platform and internal CRM.",
      context: 'onboarding-day-1',
      metadata: { stage: 'expansion', date: '2026-03-12' },
    },
    {
      content: 'David completed onboarding in 2 days, set up all team permissions, read through full API documentation, built proof-of-concept integration locally.',
      context: 'expansion-day-5',
      metadata: { stage: 'expansion', date: '2026-04-05' },
    },
    {
      content: 'David hit a blocker: OAuth authentication failing in production environment. POC works locally but not in prod. He is investigating independently.',
      context: 'expansion-day-10',
      metadata: { stage: 'expansion', date: '2026-04-11', blocker: 'oauth-failing-production', health: 'engaged' },
    },
    {
      content: 'David is a senior developer, very technical, prefers code examples over explanations. Does not need hand-holding.',
      context: 'customer-preferences',
      metadata: { preference: 'code-examples', technicalLevel: 'developer' },
    },
  ]);
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 Seeding demo customer personas into Hindsight...\n');

  await seedSarah();  console.log('');
  await seedRaj();    console.log('');
  await seedPriya();  console.log('');
  await seedJames();  console.log('');
  await seedLisa();   console.log('');
  await seedDavid();

  console.log('\n✅ Seed complete!');
  console.log('\nDemo personas ready:');
  console.log('  • priya   — Ops Manager, adoption stage, CSV blocker unresolved');
  console.log('  • james   — Founder, going quiet, SSO blocker with IT');
  console.log('  • lisa    — Enterprise, 22% deflection, close to goal');
  console.log('  • david   — Developer, expansion stage, OAuth blocker in prod');
  console.log('  • customer-sarah — Mid-journey, engaged, 62% to goal');
  console.log('  • customer-raj   — At-risk, stuck on blocker\n');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
