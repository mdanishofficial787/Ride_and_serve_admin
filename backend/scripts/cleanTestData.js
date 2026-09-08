import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://sadiarafiquedev_db_user:KhmXmAyYP9SxabFR@cluster0.yhrbvje.mongodb.net/test?appName=Cluster0';

async function clean() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Delete the 3 Dubai test rides
  const testIds = [
    new mongoose.Types.ObjectId('6a9fc22628d9a0a9442e80bd'),
    new mongoose.Types.ObjectId('6a9fc2bea97247042d1c49b5'),
    new mongoose.Types.ObjectId('6a9fc2bea97247042d1c49b6')
  ];

  const rideRes = await db.collection('rides').deleteMany({
    _id: { $in: testIds }
  });
  console.log('Deleted Dubai test rides:', rideRes.deletedCount);

  // Check remaining rides
  const remainingRides = await db.collection('rides').find({}).toArray();
  console.log('Remaining rides in database:', remainingRides.length);

  // Check requests in database
  const requests = await db.collection('requests').find({}).toArray();
  console.log('Authentic requests in database:', requests.length);
  requests.forEach(r => console.log(' ->', r.requestId, r.customerName, r.status));

  await mongoose.disconnect();
}

clean().catch(console.error);
