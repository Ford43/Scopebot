export const BOT_AVATAR_COLOURS = [
  "bg-amber-400",
  "bg-orange-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-violet-400",
] as const;

export function botAvatarColour(index: number): string {
  return BOT_AVATAR_COLOURS[index % BOT_AVATAR_COLOURS.length];
}
