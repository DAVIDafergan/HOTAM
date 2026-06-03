// NOTE: Invoice4u webhooks are currently handled by the same handler as Sumit.
// If Invoice4u is ever configured to send webhooks with a different payload format,
// create a dedicated handler here instead of re-exporting.
export { GET, POST } from '../../payments/webhook/route';
