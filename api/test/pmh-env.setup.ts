// Test không bao giờ đọc cấu hình PMH ID thật dù shell có biến PMH_*
for (const k of Object.keys(process.env)) {
  if (k.startsWith('PMH_')) delete process.env[k];
}
