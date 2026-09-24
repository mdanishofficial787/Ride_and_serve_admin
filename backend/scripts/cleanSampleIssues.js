import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function cleanMockIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const client = mongoose.connection.client;

    for (const dbName of ['ride_and_serve', 'test']) {
      for (const colName of ['driverissues', 'issuereports']) {
        const col = client.db(dbName).collection(colName);
        const result = await col.deleteMany({
          $or: [
            { issueId: { $in: ['ISS-1001', 'ISS-1002', 'ISS-9613'] } },
            { driverName: { $in: ['Ahmed Raza', 'Mohammad Ali', 'Tariq Mehmood'] } }
          ]
        });
        if (result.deletedCount > 0) {
          console.log(`✅ Deleted ${result.deletedCount} hardcoded issues from ${dbName}.${colName}`);
        }
      }
    }

    // Verify remaining issues
    console.log('\n--- Remaining Real-Time Issues in Database ---');
    for (const dbName of ['test', 'ride_and_serve']) {
      for (const colName of ['issuereports', 'driverissues']) {
        const remaining = await client.db(dbName).collection(colName).find({}).toArray();
        if (remaining.length > 0) {
          console.log(`📂 ${dbName}.${colName} (${remaining.length} issues):`);
          remaining.forEach(r => {
            console.log(`   • ${r.issueId || 'ISS-AUTO'} | Driver: ${r.driverName} | Reason: ${r.reason} | Status: ${r.status}`);
          });
        }
      }
    }

    await mongoose.disconnect();
    console.log('\nDone.');
  } catch (err) {
    console.error('Error cleaning mock issues:', err);
  }
}

cleanMockIssues();
