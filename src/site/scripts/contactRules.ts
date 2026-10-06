/**
 * The contact form's rules, as the site's tier 0 offers them to its components: the very module the
 * contact service checks with (contact-api/src/rules.mjs; documentation/contact/spec.md D6), so the form
 * and the service can never disagree about what's valid.
 */
export { accessRequest, checkField, checkFields, cleanFields, countLinks, errorText, firstName, LIMITS } from '../../../contact-api/src/rules.mjs';
export type { Field, Fields, Problem } from '../../../contact-api/src/rules.mjs';
