import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export let isMemoryMode = false;

// Simple in-memory document store fallback
export const memoryStore = {
  drivers: [],
  requests: [],
  assignments: [],
  adminStats: null
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://sadiarafiquedev_db_user:KhmXmAyYP9SxabFR@cluster0.yhrbvje.mongodb.net/ride_and_serve?appName=Cluster0';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log(`[MongoDB] Successfully connected to database: ${conn.connection.name} at ${conn.connection.host}`);
    isMemoryMode = false;
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Atlas Connection Error: ${err.message}`);
    if (process.env.USE_IN_MEMORY_DB_IF_LOCAL_FAILS === 'true') {
      console.log('[MongoDB] Switching to In-Memory Database Engine fallback.');
      isMemoryMode = true;
    } else {
      isMemoryMode = false;
    }
    return null;
  }
};

export const closeDB = async () => {
  if (!isMemoryMode) {
    await mongoose.connection.close();
  }
};
