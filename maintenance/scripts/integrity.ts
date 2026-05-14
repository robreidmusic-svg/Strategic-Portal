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

async function takeForecastSnapshots(db: any) {
  const today = new Date();
  // Only take snapshots on Sundays (0) to create a clean weekly timeline
  if (today.getDay() !== 0) {
    console.log("📅 Skipping Forecast Snapshot (Not Sunday).");
    return;
  }

  console.log("📸 Taking Weekly Forecast Snapshots...");
  const units = ['Hyperscale', 'Strategic Wholesale', 'China/Apac', 'U.S AI'];
  
  for (const unit of units) {
    const latest = await db.collection("forecastHistory")
      .where("unit", "==", unit)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (!latest.empty) {
      const data = latest.docs[0].data();
      await db.collection("forecast_snapshots").add({
        ...data,
        snapshotDate: today.toISOString().slice(0, 10),
        snapshotTimestamp: Date.now()
      });
      console.log(`  ✅ Snapshot taken for ${unit}`);
    }
  }
}

async function runIntegrityAudit() {
  try {
    const db = await getDb();
    await auditOpportunities(db);
    await auditProposals(db);
    await takeForecastSnapshots(db);
    console.log("🏁 Integrity Audit Finished Successfully.");
  } catch (e) {
    console.error("❌ Integrity Audit Failed:", e);
    process.exit(1);
  }
}

runIntegrityAudit();
