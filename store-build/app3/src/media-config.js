// USAGE: media.js reads this base URL for private file uploads.
// TODO: files.caresits.xyz is the gatekeeper's design host, not a deployed service yet. Its current core rejects user-media, space-media, and video-intros and does not plan keys under users/<uid>/ or spaces/<spaceId>/. Confirm the live URL, server support, and CORS setup before launch.
export const MEDIA_GATEKEEPER_BASE_URL = "https://files.caresits.xyz";
