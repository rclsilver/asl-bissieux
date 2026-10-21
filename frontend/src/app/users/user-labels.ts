import { APISchemas } from '../core/api/openapi';

export const accessLabels: Record<string, string> = {
  active: 'Actif',
  pending: 'Demande en attente',
  rejected: 'Accès refusé',
  disabled: 'Accès désactivé',
};
export function accessState(user: APISchemas['AuthUser']) {
  return user.access_status ?? (user.enabled ? 'active' : 'disabled');
}
export function providerLabel(user: APISchemas['AuthUser']) {
  return (
    [
      ...new Set(
        (user.identities ?? []).map((i) =>
          i.issuer === 'https://accounts.google.com'
            ? 'Google'
            : i.issuer?.includes('/realms/')
              ? 'Keycloak'
              : 'Fournisseur OIDC'
        )
      ),
    ].join(', ') || 'Identité non associée'
  );
}
const permissions: Record<string, string> = {
  'budget.CreateBudget': 'Créer un budget',
  'budget.UpdateBudget': 'Renommer un budget',
  'budget.DeleteBudget': 'Supprimer un brouillon',
  'budget.PublishBudget': 'Publier les appels de cotisation',
  'budget.CreateExpense': 'Ajouter une dépense au brouillon',
  'budget.UpdateExpense': 'Modifier une dépense du brouillon',
  'budget.DeleteExpense': 'Supprimer une dépense du brouillon',
  'budget.CreatePayment': 'Enregistrer un paiement',
  'budget.UpdatePayment': 'Corriger un paiement',
  'budget.DeletePayment': 'Supprimer un paiement',
  'budget.CreateRefund': 'Enregistrer et annuler un remboursement',
  'budget.CreateAdjustment': 'Ajuster et annuler un appel publié',
  'budget.SendEmail': 'Préparer une campagne depuis un budget',
  'email.CreateEmailTemplate': 'Créer un modèle d’e-mail',
  'email.UpdateEmailTemplate': 'Modifier un modèle d’e-mail',
  'email.DeleteEmailTemplate': 'Supprimer un modèle d’e-mail',
  'email.AddAttachment': 'Ajouter une pièce jointe',
  'email.RemoveAttachment': 'Retirer une pièce jointe',
  'email.CreateEmailCampaign': 'Créer une campagne',
  'email.DeleteEmailCampaign': 'Supprimer une campagne',
  'email.DeleteEmail': 'Supprimer un e-mail',
  'email.SendEmail': 'Envoyer des e-mails',
  'email.SetError': 'Autoriser un renvoi après vérification',
  'member.CreateMember': 'Ajouter un membre',
  'member.UpdateMember': 'Modifier un membre',
  'member.DeleteMember': 'Supprimer un membre',
  'member.LinkUnit': 'Associer un membre à un lot',
  'member.UnlinkUnit': 'Retirer un membre d’un lot',
  'unit.CreateUnit': 'Ajouter un lot',
  'unit.UpdateUnit': 'Modifier un lot',
  'unit.DeleteUnit': 'Supprimer un lot',
};
export function permissionLabel(action: string) {
  return permissions[action] ?? `Autorisation historique : ${action}`;
}
export function permissionGroup(action: string) {
  return (
    (
      {
        budget: 'Budgets et paiements',
        email: 'E-mails',
        member: 'Annuaire — membres',
        unit: 'Annuaire — lots',
      } as Record<string, string>
    )[action.split('.')[0]] ?? 'Autorisations historiques'
  );
}
