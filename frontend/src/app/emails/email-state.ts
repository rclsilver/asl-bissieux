import { APISchemas } from '../core/api/openapi';

type EmailState = APISchemas['ModelsEmail']['state'];

export function canSendEmail(state: EmailState): boolean {
  return state === 'WAITING' || state === 'ERROR';
}

export function canResetEmail(state: EmailState): boolean {
  return state === 'SENT' || state === 'READ' || state === 'UNKNOWN';
}

export function emailStateLabel(state: EmailState): string {
  const labels: Record<string, string> = {
    WAITING: 'En attente', SENDING: 'En cours', UNKNOWN: 'À vérifier',
    SENT: 'Envoyé', ERROR: 'Erreur', READ: 'Lu',
  };
  return labels[state ?? ''] ?? 'État inconnu';
}
