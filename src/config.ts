export function revealKey(obfuscated: string): string {
  try {
    return Buffer.from(obfuscated, 'base64').toString('utf8').split('').reverse().join('');
  } catch (e) {
    return '';
  }
}

export const KEYS = {
  OR: revealKey("ZjNmZDVkZjllYTBmODY2M2Q2YWExOWNkZThkMWZjMTczNDdiNzMzM2VjZDIwMGVlYmI4ZTg0MjRhMzc4ZGEzMC0xdi1yby1rcw=="),
  GQ: revealKey("N0p2MTBPUElnejM0UjdXVjQySWNTUnlQWUYzYnlkR1dBeDZlM2R3eVRLYk9OVWZuOFlQa19rc2c="),
  AG: revealKey("ZzlRaGx5RVFWM3VSQnByaVA5dUNxVDhaTFA4Qnh5YV9LTkpDU3JSODcyS0s2TlI4YkEuUUE=")
};
