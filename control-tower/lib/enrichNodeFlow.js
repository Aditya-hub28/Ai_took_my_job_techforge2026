require("dotenv").config({ path: "../.env.local" });
const { MongoClient } = require("mongodb");

async function enrichFlow() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/muletrace_auth";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB:", uri);
    const db = client.db();

    console.log("Reading all transactions...");
    const txs = await db.collection("transactions").find({}).project({ source: 1, target: 1, amount: 1 }).toArray();
    console.log(`Loaded ${txs.length} transactions. Aggregating in-memory...`);

    const stats = new Map();

    function getOrCreate(id) {
      if (!stats.has(id)) {
        stats.set(id, { totalIn: 0, totalOut: 0, inDeg: 0, outDeg: 0 });
      }
      return stats.get(id);
    }

    for (const t of txs) {
      if (!t.source || !t.target) continue;
      const s = String(t.source).split("_")[0];
      const tg = String(t.target).split("_")[0];
      const amt = parseFloat(t.amount || 0);

      const sObj = getOrCreate(s);
      sObj.totalOut += amt;
      sObj.outDeg += 1;

      const tgObj = getOrCreate(tg);
      tgObj.totalIn += amt;
      tgObj.inDeg += 1;
    }

    console.log(`Aggregated stats for ${stats.size} accounts. Writing to nodes collection...`);

    let bulk = [];
    let updated = 0;

    for (const [nodeIdStr, st] of stats.entries()) {
      const numId = parseInt(nodeIdStr);
      if (isNaN(numId)) continue;

      const inOutRatio = st.totalOut > 0 ? Number((st.totalIn / st.totalOut).toFixed(4)) : (st.totalIn > 0 ? 999 : 1);

      bulk.push({
        updateOne: {
          filter: { node_id: numId },
          update: {
            $set: {
              total_incoming: Number(st.totalIn.toFixed(2)),
              total_outgoing: Number(st.totalOut.toFixed(2)),
              in_degree: st.inDeg,
              out_degree: st.outDeg,
              in_out_ratio: inOutRatio,
            }
          }
        }
      });

      if (bulk.length >= 1000) {
        await db.collection("nodes").bulkWrite(bulk);
        updated += bulk.length;
        console.log(`Updated ${updated} nodes with real flow stats...`);
        bulk = [];
      }
    }

    if (bulk.length > 0) {
      await db.collection("nodes").bulkWrite(bulk);
      updated += bulk.length;
    }

    console.log(`✅ Finished! Updated ${updated} nodes with precise incoming, outgoing, and degree metrics.`);
  } catch (err) {
    console.error("❌ Error in enrichFlow:", err);
  } finally {
    await client.close();
  }
}

enrichFlow();
