import { getDb } from "./db";

async function auditOpportunities(db: any) {
  console.log("🔍 Auditing Opportunities...");
  const snapshot = await db.collection("opportunities").get();
  let fixCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};

    if (!data.stage) updates.stage = "Lead";
    if (data.mrc === undefined) updates.mrc = 0;
    if (data.isIncludedInCall === undefined) updates.isIncludedInCall = false;
    if (!data.forecastMonth) updates.forecastMonth = new Date().toISOString().slice(0, 7);

    if (Object.keys(updates).length > 0) {
      console.log(`  🔧 Auto-fixing Opportunity ${doc.id}:`, updates);
      await doc.ref.update(updates);
      fixCount++;
    }
  }
  console.log(`✅ Opportunities Audit Complete. Fixed: ${fixCount}`);
}

async function auditProposals(db: any) {
  console.log("🔍 Auditing Research Proposals...");
  const snapshot = await db.collection("research_proposals").get();
  let fixCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};

    if (!data.status) updates.status = "pending";
    if (!data.createdAt) updates.createdAt = Date.now();
    if (!data.scope) updates.scope = "Quick";

    if (Object.keys(updates).length > 0) {
      console.log(`  🔧 Auto-fixing Proposal ${doc.id}:`, updates);
      await doc.ref.update(updates);
      fixCount++;
    }
  }
  console.log(`✅ Proposals Audit Complete. Fixed: ${fixCount}`);
}

async function runIntegrityAudit() {
  try {
    const db = await getDb();
    await auditOpportunities(db);
    await auditProposals(db);
    console.log("🏁 Integrity Audit Finished Successfully.");
  } catch (e) {
    console.error("❌ Integrity Audit Failed:", e);
    process.exit(1);
  }
}

runIntegrityAudit();
