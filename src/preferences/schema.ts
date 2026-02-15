import { t } from "elysia";

export const PreferencesBody = t.Object({
  locale: t.Optional(t.Union([t.Literal("ko"), t.Literal("en")])),
  dateFormat: t.Optional(
    t.Union([
      t.Literal("short"),
      t.Literal("medium"),
      t.Literal("iso"),
      t.Literal("slash"),
      t.Literal("dot"),
    ])
  ),
  timeFormat: t.Optional(
    t.Union([
      t.Literal("24h"),
      t.Literal("12h"),
      t.Literal("24h-sec"),
    ])
  ),
  sidebarPosition: t.Optional(
    t.Union([
      t.Literal("left"),
      t.Literal("right"),
      t.Literal("top"),
      t.Literal("bottom"),
    ])
  ),
  searchThreshold: t.Optional(t.Number({ minimum: 0.1, maximum: 0.95 })),
  searchTopK: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
});
