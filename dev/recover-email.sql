-- OFFLINE RECOVERY ONLY: stop ALL application instances/workers first.
-- Verify delivery with the SMTP provider before authorizing any later resend.
-- Required psql variable: email_id. No SMTP operation is performed here.
UPDATE email
SET state = 'UNKNOWN', error = 'Envoi interrompu : réception à vérifier avant tout renvoi.', updated_at = now()
WHERE id = :'email_id'::uuid AND state = 'SENDING' AND deleted_at IS NULL;
