require("dotenv").config({ path: "../.env.local" });
const { MongoClient } = require("mongodb");

async function updateGraphData() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mule_hunter_auth";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB:", uri);
    const db = client.db();

    const cursor = db.collection("nodes").find({});
    let ops = [];
    let updated = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const isFraud = doc.is_fraud === "1" || doc.is_fraud === 1;
      const ringMem = parseInt(doc.ring_membership) || 0;
      const secondHop = parseFloat(doc.second_hop_fraud_rate) || 0;
      const commFraud = parseFloat(doc.community_fraud_rate) || 0;
      const pr = parseFloat(doc.pagerank) || 0;

      let score = 0.0;
      if (isFraud) {
        score = secondHop > 0 ? secondHop : (commFraud > 0 ? commFraud : 0.85);
      } else {
        score = Math.max(0.01, Math.min(0.25, commFraud));
      }

      const ringIds = ringMem > 0 ? [ringMem] : [];
      const role = isFraud && pr > 0.00008 ? "HUB" 
                 : (isFraud && ringIds.length > 0 ? "BRIDGE" 
                 : (isFraud ? "MULE" : "NORMAL"));

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              is_anomalous: isFraud ? 1 : 0,
              anomaly_score: Number(score.toFixed(4)),
              ring_ids: ringIds,
              role: role,
            }
          }
        }
      });

      if (ops.length >= 1000) {
        await db.collection("nodes").bulkWrite(ops);
        updated += ops.length;
        console.log(`Updated ${updated} nodes...`);
        ops = [];
      }
    }

    if (ops.length > 0) {
      await db.collection("nodes").bulkWrite(ops);
      updated += ops.length;
    }

    console.log(`✅ Successfully updated ${updated} nodes with fraud, anomaly score, and ring info!`);
  } catch (err) {
    console.error("❌ Error updating graph data:", err);
  } finally {
    await client.close();
  }
}

updateGraphData();
