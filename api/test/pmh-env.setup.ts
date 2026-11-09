// Test không bao giờ đọc cấu hình PMH ID/SMTP thật dù shell có biến PMH_*/SMTP_*
for (const k of Object.keys(process.env)) {
  if (k.startsWith('PMH_') || k.startsWith('SMTP_')) delete process.env[k];
}
