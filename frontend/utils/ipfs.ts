import { Web3Storage } from "web3.storage";

function getAccessToken(): string {
  const token = process.env.NEXT_PUBLIC_WEB3STORAGE_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_WEB3STORAGE_TOKEN is not set");
  }
  return token;
}

function makeStorageClient(): Web3Storage {
  return new Web3Storage({ token: getAccessToken() });
}

export async function uploadToIPFS(data: {
  message: string;
  category: string;
  budget?: string;
  additionalInfo?: string;
}): Promise<string> {
  const client = makeStorageClient();
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  
  const file = new File([blob], "intent.json", { type: "application/json" });
  
  console.log("Uploading to IPFS via web3.storage...");
  const cid = await client.put([file], {
    wrapWithDirectory: false,
  });
  
  console.log("Uploaded! CID:", cid);
  return cid;
}

export async function fetchFromIPFS(cid: string): Promise<any> {
  const client = makeStorageClient();
  const res = await client.get(cid);
  
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch from IPFS: ${cid}`);
  }
  
  const files = await res.files();
  if (files.length === 0) {
    throw new Error(`No files found for CID: ${cid}`);
  }
  
  const file = files[0];
  const text = await file.text();
  return JSON.parse(text);
}

