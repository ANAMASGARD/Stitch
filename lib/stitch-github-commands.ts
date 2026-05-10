/** True if the GitHub comment body triggers the Stitch auto-PR flow. */
export function hasStitchFixCommand(body: string): boolean {
  const t = body.replace(/^\uFEFF?/, "").trimStart();
  return /^\/stitch fix(\b|\s|$)/i.test(t);
}
