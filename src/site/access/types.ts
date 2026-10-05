export type GrantKind = 'code' | 'link';

export interface Grant {
  id: string;
  kind: GrantKind;
  name?: string;
  recipient: { name: string; organisation?: string; role?: string; email?: string };
  purpose: string;
  scope: { sections?: string[]; pages?: string[] };
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  secret: { words?: string; key?: string; salt: string };
  notes?: string;
}

export interface AccessFile {
  grants: Grant[];
}

export type GrantState = 'active' | 'expiring' | 'expired' | 'withdrawn';

export interface KeyringBody {
  v: 1;
  grant: string;
  expiresAt?: string;
  keys: Record<string, string>;
}

export interface KeyringEnvelope {
  v: 1;
  build: string;
  kdf: 'pbkdf2-sha256' | 'hkdf-sha256';
  iterations?: number;
  salt: string;
  iv: string;
  data: string;
}
