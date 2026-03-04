/**
 * MongoDB Connection Diagnostic Script
 * 
 * This script helps diagnose MongoDB Atlas connection issues by:
 * 1. Testing DNS resolution
 * 2. Testing SRV record resolution
 * 3. Attempting a connection
 * 
 * Usage: npx ts-node scripts/test-mongodb-connection.ts
 */

import dotenv from 'dotenv';
import dns from 'dns';
import { promisify } from 'util';
import mongoose from 'mongoose';

dotenv.config();

const resolveSrv = promisify(dns.resolveSrv);
const lookup = promisify(dns.lookup);
const resolve4 = promisify(dns.resolve4);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('💡 Please set it in your .env file');
  process.exit(1);
}

async function getCurrentIP(): Promise<string> {
  try {
    const https = await import('https');
    return new Promise((resolve, reject) => {
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.ip);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  } catch (error) {
    return 'Unable to determine';
  }
}

async function runDiagnostics() {
  console.log('🔍 MongoDB Connection Diagnostics\n');
  console.log('=' .repeat(60));
  
  // Get current IP
  console.log('\n📡 Current IP Address:');
  try {
    const currentIP = await getCurrentIP();
    console.log(`   Your public IP: ${currentIP}`);
    console.log(`   💡 Make sure this IP is whitelisted in MongoDB Atlas!`);
    console.log(`   💡 Go to: https://cloud.mongodb.com/ → Network Access`);
  } catch (error) {
    console.log('   ⚠️  Could not determine IP address');
  }
  
  // Extract hostname from URI
  const match = MONGODB_URI!.match(/@([^/]+)\//);
  if (!match) {
    console.error('❌ Could not extract hostname from connection string');
    process.exit(1);
  }
  
  const hostname = match[1];
  console.log(`\n🌐 Testing DNS Resolution for: ${hostname}`);
  console.log('-'.repeat(60));
  
  // Test 1: Basic DNS lookup
  console.log('\n1️⃣  Testing Basic DNS Lookup...');
  try {
    const addresses = await lookup(hostname);
    console.log(`   ✅ SUCCESS: ${hostname} resolves to ${addresses.address}`);
  } catch (dnsError: any) {
    console.error(`   ❌ FAILED: ${dnsError.message}`);
    console.error(`   💡 This indicates a DNS resolution problem`);
  }
  
  // Test 2: A record resolution
  console.log('\n2️⃣  Testing A Record Resolution...');
  try {
    const aRecords = await resolve4(hostname);
    console.log(`   ✅ SUCCESS: Found ${aRecords.length} A record(s)`);
    aRecords.forEach((ip, idx) => {
      console.log(`      ${idx + 1}. ${ip}`);
    });
  } catch (aError: any) {
    console.error(`   ❌ FAILED: ${aError.message}`);
  }
  
  // Test 3: SRV record resolution (critical for MongoDB)
  console.log('\n3️⃣  Testing SRV Record Resolution (Critical for MongoDB)...');
  const srvHost = `_mongodb._tcp.${hostname}`;
  console.log(`   Checking: ${srvHost}`);
  try {
    const srvRecords = await resolveSrv(srvHost);
    console.log(`   ✅ SUCCESS: Found ${srvRecords.length} SRV record(s)`);
    srvRecords.forEach((record, idx) => {
      console.log(`      ${idx + 1}. ${record.name}:${record.port}`);
      console.log(`         Priority: ${record.priority}, Weight: ${record.weight}`);
    });
  } catch (srvError: any) {
    console.error(`   ❌ FAILED: ${srvError.message}`);
    console.error(`   💡 THIS IS LIKELY THE ROOT CAUSE!`);
    console.error(`   💡 SRV record resolution is required for MongoDB Atlas`);
    console.error(`\n   Possible solutions:`);
    console.error(`   1. Flush DNS cache: ipconfig /flushdns`);
    console.error(`   2. Change DNS server to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)`);
    console.error(`   3. Check Windows Firewall settings`);
    console.error(`   4. Check if you're behind a corporate proxy/firewall`);
    console.error(`   5. Try using a VPN or mobile hotspot`);
  }
  
  // Test 4: Actual MongoDB connection
  console.log('\n4️⃣  Testing MongoDB Connection...');
  console.log('-'.repeat(60));
  try {
    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    };
    
    console.log('   Attempting connection...');
    const conn = await mongoose.connect(MONGODB_URI!, options);
    console.log(`   ✅ SUCCESS: Connected to MongoDB!`);
    console.log(`      Host: ${conn.connection.host}`);
    console.log(`      Database: ${conn.connection.name}`);
    
    await mongoose.connection.close();
    console.log('\n✅ All diagnostics passed! Connection is working.');
  } catch (connError: any) {
    console.error(`   ❌ FAILED: ${connError.message}`);
    console.error(`   Error Code: ${connError.code}`);
    console.error(`   Error Name: ${connError.name}`);
    
    if (connError.code === 'ECONNREFUSED' || connError.code === 'ENOTFOUND') {
      console.error(`\n   💡 This confirms a DNS/network issue`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Diagnostics complete!\n');
}

// Run diagnostics
runDiagnostics()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
