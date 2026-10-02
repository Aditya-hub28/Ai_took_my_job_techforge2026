const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/mule_hunter_auth');
  await client.connect();
  const db = client.db();
  const ringNodes = await db.collection('nodes').find({ ring_ids: { $exists: true, $ne: [] } }).toArray();
  const byRing = {};
  for (const n of ringNodes) {
    for (const r of (n.ring_ids || [])) {
      if (!byRing[r]) byRing[r] = [];
      byRing[r].push(n);
    }
  }
  for (const [r, members] of Object.entries(byRing).sort((a,b)=>b[1].length - a[1].length)) {
    const ringVols = members.map(m => parseFloat(m.ring_volume || 0)).filter(v => v > 0);
    const inVols = members.map(m => parseFloat(m.total_incoming || 0));
    console.log(`Ring #${r} (${members.length} members):`);
    console.log(`   ring_volume field: ${ringVols[0] || 0}`);
    console.log(`   sum of incoming txs: ${inVols.reduce((a,b)=>a+b, 0)}`);
  }
  await client.close();
}
run();
