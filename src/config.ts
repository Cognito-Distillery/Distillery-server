/**
 * CORS whitelist.
 *
 * - Empty array → allow all origins (use a reverse proxy to restrict access)
 * - Add origins to restrict at the application level:
 *     ["https://app.example.com", "https://admin.example.com"]
 */
export const corsOrigins: string[] = [];
