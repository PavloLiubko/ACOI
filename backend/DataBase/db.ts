import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';

const url = process.env.MONGO_URL;
const dbName = process.env.MONGODB_NAME;

if (!url) throw new Error('MONGO_URL is not set');
if (!dbName) throw new Error('MONGODB_NAME is not set');

const client = new MongoClient(url);
let db: Db | undefined;

export async function connectDB(): Promise<Db> {
    if (db) return db;
    await client.connect();
    db = client.db(dbName);
    console.log('MongoDB connected');
    return db;
}

export function getDB(): Db {
    if (!db) {
        throw new Error('DB not connected');
    }
    return db;
}