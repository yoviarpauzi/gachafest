/** The API is for the organizer's own laptop (reached through the Vite proxy), never the venue network. */
export const HOST = "127.0.0.1";

type Listenable<T> = { listen(options: { port: number; hostname: string }): T };

export function listen<T>(app: Listenable<T>, port: number): T {
  return app.listen({ port, hostname: HOST });
}
