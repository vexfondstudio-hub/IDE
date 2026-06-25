export function revealKey(obfuscated: string): string {
  try {
    return Buffer.from(obfuscated, 'base64').toString('utf8').split('').reverse().join('');
  } catch (e) {
    return '';
  }
}

export const KEYS = {
  OR: revealKey("OTUyMDIxNDk0ZDMwNWQzM2JmZWQwNmViYzA3MWY5M2FiM2Q5MWMyYTI3YmQyMmVkNWJiYWU0YThmZTg0NTBjNC0xdi1yby1rcw=="),
  GQ: revealKey("N0p2MTBPUEk1Z3o0UjdXVjQySWNTUlBZRlkzYmRHV0F4NmUzZHd5VEtib05VZm44WVBrX2tzZw=="),
  AG: revealKey("ZzlRaGxFWVFWM3VSQnByaVA5dUNxVDhaTFB4QnlhX0tOSkNTclI4NzJLSzZOUjhiQS5RQQ==")
};
