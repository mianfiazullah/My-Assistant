import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "ai-studio-applet-webapp-3af71"
  });
}

const db = getFirestore(admin.apps[0], "ai-studio-1caa2061-b4a2-4007-b64b-0f6cf6643e69");

async function main() {
  console.log("=== CHECKING CASES COLLECTION ===");
  const casesSnapshot = await db.collection('cases').get();
  console.log(`Total active cases found: ${casesSnapshot.size}`);
  
  casesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const refNum = data.referenceNumber || (data.billData ? data.billData.referenceNumber : '');
    const name = data.name || (data.billData ? data.billData.consumerName : '');
    console.log(`- CASE Document ID: ${doc.id}`);
    console.log(`  Name: ${name}`);
    console.log(`  Reference #: ${refNum}`);
    console.log(`  Created At: ${data.createdAt}`);
  });

  console.log("\n=== CHECKING TRASH COLLECTION ===");
  const trashSnapshot = await db.collection('trash').get();
  console.log(`Total trash documents found: ${trashSnapshot.size}`);
  
  trashSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const refNum = data.referenceNumber || (data.billData ? data.billData.referenceNumber : '');
    const name = data.name || (data.billData ? data.billData.consumerName : '');
    console.log(`- TRASH Document ID: ${doc.id}`);
    console.log(`  Name: ${name}`);
    console.log(`  Reference #: ${refNum}`);
    console.log(`  Deleted At: ${data.deletedAt || data.updatedAt}`);
  });
}

main().catch(console.error);
