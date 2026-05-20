import { getDb } from "./db";

// Set MAINTENANCE_DRY_RUN=true in .env to audit without committing any changes.
const DRY_RUN = process.env.MAINTENANCE_DRY_RUN === "true";
if (DRY_RUN) console.log("🧪 DRY RUN MODE — No changes will be committed to Firestore.");

async function auditOpportunities(db: any) {
  console.log("🔍 Auditing Opportunities...");
  const snapshot = await db.collection("opportunities").get();
  const batch = db.batch();
  let fixCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};

    // Use strict undefined/null checks to avoid overwriting intentionally empty values.
    if (data.stage === undefined || data.stage === null) updates.stage = "Lead";
    if (data.mrc === undefined) updates.mrc = 0;
    if (data.isIncludedInCall === undefined) updates.isIncludedInCall = false;
    if (data.forecastMonth === undefined || data.forecastMonth === null)
      updates.forecastMonth = new Date().toISOString().slice(0, 7);

    if (Object.keys(updates).length > 0) {
      console.log(`  🔧 ${DRY_RUN ? "[DRY RUN] Would fix" : "Auto-fixing"} Opportunity ${doc.id}:`, updates);
      if (!DRY_RUN) batch.update(doc.ref, updates);
      fixCount++;
    }
  }

  // Atomic commit — all fixes applied together or not at all.
  if (!DRY_RUN) await batch.commit();
  console.log(`✅ Opportunities Audit Complete. ${DRY_RUN ? "Would fix" : "Fixed"}: ${fixCount}`);
}

async function auditProposals(db: any) {
  console.log("🔍 Auditing Research Proposals...");
  const snapshot = await db.collection("research_proposals").get();
  const batch = db.batch();
  let fixCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};

    // Use strict undefined/null checks to avoid overwriting intentionally empty values.
    if (data.status === undefined || data.status === null) updates.status = "pending";
    if (data.createdAt === undefined || data.createdAt === null) updates.createdAt = Date.now();
    if (data.scope === undefined || data.scope === null) updates.scope = "Quick";

    if (Object.keys(updates).length > 0) {
      console.log(`  🔧 ${DRY_RUN ? "[DRY RUN] Would fix" : "Auto-fixing"} Proposal ${doc.id}:`, updates);
      if (!DRY_RUN) batch.update(doc.ref, updates);
      fixCount++;
    }
  }

  // Atomic commit — all fixes applied together or not at all.
  if (!DRY_RUN) await batch.commit();
  console.log(`✅ Proposals Audit Complete. ${DRY_RUN ? "Would fix" : "Fixed"}: ${fixCount}`);
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
