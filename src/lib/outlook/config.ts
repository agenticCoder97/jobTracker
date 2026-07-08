import 'server-only';

export type OutlookConfig = {
  clientId: string;
  clientSecret: string;
  tenant: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  scanSigningSecret: string;
  scopes: string[];
};

const scopes = ['openid', 'profile', 'offline_access', 'Mail.Read'];

const requiredEnvKeys = [
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_REDIRECT_URI',
  'OUTLOOK_TOKEN_ENCRYPTION_KEY',
  'OUTLOOK_SCAN_SIGNING_SECRET',
] as const;

function readRequiredEnv(): Record<(typeof requiredEnvKeys)[number], string> {
  const missing = requiredEnvKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Outlook environment variables: ${missing.join(', ')}`);
  }

  return {
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID!,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET!,
    MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI!,
    OUTLOOK_TOKEN_ENCRYPTION_KEY: process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY!,
    OUTLOOK_SCAN_SIGNING_SECRET: process.env.OUTLOOK_SCAN_SIGNING_SECRET!,
  };
}

export function getOutlookConfig(): OutlookConfig {
  const env = readRequiredEnv();

  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    tenant: process.env.MICROSOFT_TENANT || 'common',
    redirectUri: env.MICROSOFT_REDIRECT_URI,
    tokenEncryptionKey: env.OUTLOOK_TOKEN_ENCRYPTION_KEY,
    scanSigningSecret: env.OUTLOOK_SCAN_SIGNING_SECRET,
    scopes,
  };
}
