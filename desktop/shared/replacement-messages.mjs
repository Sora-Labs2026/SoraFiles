// Fixed reason codes from the license service's email verification, mapped to
// the only messages Desktop shows for them. Keep in sync with the service.
export const replacementMessages=Object.freeze({
 'email-required':'Enter the email address you used for your purchase.',
 'email-mismatch':'That email does not match the purchase for this license. Check the address and try again.',
 'email-cooldown':'Please wait a minute before requesting another code.',
 'email-rate-limited':'Too many codes were requested. Try again in an hour.',
 'email-attempts':'Too many attempts with a different email. Try again in an hour.',
 'email-delivery-failed':'The email could not be sent, so no code was sent. Try again in a few minutes.',
 'license-unverified':'This license could not be verified online. Check your license key and connection, then try again.',
 'code-invalid':'That code is not correct. Check the email and try again.',
 'code-used':'This code was already used. Send a new code.',
 'code-superseded':'A newer code was sent. Use the code from the most recent email.',
 'code-expired':'This code has expired. Send a new code.',
 'code-locked':'Too many incorrect codes. Send a new code.',
 'license-key-required':'Enter your license key.',
 'send-first':'Send a code first.',
 'payment-pending':'Check your existing revocation payment first.',
 'payment-in-progress':'A payment is still being processed, so it cannot be cancelled yet. Check payment again in a minute.',
});
export const replacementMessageList=Object.freeze(Object.values(replacementMessages));
export function replacementError(reason){return Object.assign(Error(replacementMessages[reason]||replacementMessages['license-unverified']),{reason});}
