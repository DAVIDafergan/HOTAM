# HOTAM — Site Audit Findings (Stage 0)

Audit performed before the Stage 1+ fixes described in the upgrade instructions. Each item lists what was found and what fix is planned in later stages, so this file stays useful as a changelog reference.

## 1. Raw `<img>` usage (should be `next/image` / `SmartImage`)

Confirmed in exactly the 3 files named in the brief, plus one **false positive** to rule out:

| File | Line | Context | Fix plan |
|---|---|---|---|
| `src/app/admin/page.tsx` | 549 | `<img src="https://hotam.shop/icon.svg" ... style="display:block;...">` inside a template-literal **HTML email body** (sent via `/api/send-email`) | **Not a real JSX `<img>`** — it's a string of raw HTML for an outbound email. Email clients require plain `<img>` tags; `next/image` cannot run there. Leave untouched. |
| `src/app/onboarding/seller/page.tsx` | 901, 942 | Local file-preview images (`certLocalPreview`, `localUrl` — blob/object URLs shown while a file is mid-upload, before it's persisted to Cloudinary) | Convert to `SmartImage` with `fill` + `object-contain`/`object-cover` (see note below) |
| `src/app/seller/dashboard/page.tsx` | 1257, 1372, 1525, 1996 | Same local-preview pattern (profile photo, certificate, writing sample, product image) | Same as above |

**Important nuance found during audit:** these previews use `blob:`/local object URLs, not permanent remote URLs. `SmartImage`'s custom loader (`smartImageLoader` → `buildCloudinaryImageUrl` in `src/lib/cloudinary-shared.ts:283-286`) already special-cases `data:` URLs and only rewrites URLs matching `isRemoteImageUrl` (`^https?://`) — a `blob:` URL matches neither, so the loader returns it unchanged. This means switching to `SmartImage` is safe and won't break previews, but each conversion must also swap `className="absolute inset-0 h-full w-full object-cover"` for the `fill` prop (Next/Image requires `fill` or explicit `width`/`height`), and each parent container needs to already be `position: relative` (spot-checked: they are, since the raw `<img>` already relied on `absolute inset-0` positioning).

## 2. Broken links / missing `href`

No broken or empty `href`/`<Link>` usages found (`href="#"`, `href=""`, `href={undefined}` all return zero matches). One false-positive grep hit was just a component named `LinkIcon`.

## 3. Interactive elements without accessible semantics

Targeted search for `<div ... onClick=` (the real a11y risk pattern, as opposed to any file merely containing an onClick):

| File | Line(s) | Verdict |
|---|---|---|
| `src/app/onboarding/seller/page.tsx` | 688, 692 | **False positive** — the `onClick` divs wrap a real `<RadioGroupItem>` + `<Label htmlFor>`, so the actual interactive/labelled element is the native radio input; the wrapping div's onClick is just a bigger hit-target. Already keyboard/screen-reader accessible via the radio+label. No fix needed. |
| `src/app/onboarding/seller/page.tsx` | 914 | **Real gap** — bare `<div onClick={() => certInputRef.current?.click()}>` (upload trigger), no `role`, `tabIndex`, or keyboard handler. Plan: convert to `<button type="button">` (no nested interactive elements inside, so a plain button swap is clean). |
| `src/app/seller/dashboard/page.tsx` | 1385 | **Real gap** — identical upload-trigger pattern as above. Same fix. |
| `src/app/admin/page.tsx` | 1325, 1329 | **Real gap** — clickable summary rows (`onLinkToTab(...)`) with `cursor-pointer` but no `role`/`tabIndex`/keyboard handler. Plan: convert to `<button type="button" className="w-full ...">` preserving the flex layout. |

## 4. Mobile horizontal-overflow risk

- Grepped for fixed pixel widths (`w-[Npx]`) across `src/app` and `src/components`. Most hits are safe: icon sizes (`w-[18px]`), sheet/drawer widths that are intentionally narrower than the viewport (`w-[280px]`, `w-[88vw] max-w-[320px]`), `max-w-[...]` truncation guards, and 1-2px separator/border utilities. None found forcing page-level horizontal scroll from static analysis alone.
- All 4 `<Table>` usages in `src/app/admin/page.tsx` (lines 940, 1091, 1358, 1405) use the shared `src/components/ui/table.tsx` component, which **already wraps itself** in `<div className="relative w-full overflow-auto">` — tables are self-contained horizontal-scroll islands by default, not page-level overflow risks, *provided* their flex/grid ancestors don't force them wider via the flexbox `min-width: auto` default-shrink gotcha. This needs a **live check** at 375-390px (planned for Stage 1.4) rather than trusting static analysis, since that specific flexbox interaction can't be verified by grep.

## 5. Missing Supabase loading states

Checked every route that fetches data (`customer/dashboard`, `seller/dashboard`, `admin`, `chat/[id]`, `products/[id]`, `sellers/[id]` + its client component). All have adequate loading handling:
- Client components use `isLoading`/`Loader2`/skeleton patterns already.
- `sellers/[id]` is a Server Component and already has a route-level `src/app/sellers/[id]/loading.tsx` (Next.js Suspense boundary) — no client spinner needed there.

No gaps found.

## 6. Leftover TODO/FIXME/console.log

Zero matches for `// TODO`, `// FIXME`, or `console.log(` in `src/app` or `src/components`. Clean.

## 7. Unused dependencies

`@fontsource/assistant` and `@fontsource/frank-ruhl-libre` are listed in `package.json` but have zero imports anywhere in `src/` (confirmed via grep) — the app only ever loaded Heebo via `next/font/google`. Safe to remove in Stage 2.

---

## 8. Site-wide layout weakness sweep (follow-up session)

Static grep pass (touch-target sizes, spacing) plus live 375px checks on `/login`, `/register`, `/contact`, `/reset-password`, `/terms`, `/search` (loading state only — Supabase unreachable in this sandbox, same limitation noted in section 5).

**Fixed:**
- **Navbar back button had no visible affordance.** The mobile back-chevron (`ChevronRight` button, shown whenever `pathname !== '/'`) only had `hover:bg-primary/5` with no default background/border, while the adjacent hamburger-menu button right next to it has a solid `bg-white/55 border border-white/45 shadow-premium` pill. Side-by-side, the back button looked like a bare decorative icon floating next to a "real" button. Gave it the same visible background/border treatment so both controls read as equally tappable.
- **Sub-44px touch targets on image-zoom controls.** The `−`/`+`/reset zoom buttons in the product-image lightbox (`ProductDetailsClient.tsx`) and the writing-sample lightbox (`SellerProfileClient.tsx`) were `h-8` (32px). Both dialogs have ample horizontal room (`flex flex-wrap gap-2`), so bumped to `h-10 px-4` (40px) — still compact, closer to the 44px guideline.
- **Admin delete/action icon buttons** (`admin/page.tsx`, 3 instances) were `h-8 w-8`; bumped to `h-10 w-10`.

**Checked, no issues found:** `/login`, `/register`, `/contact`, `/reset-password`, `/terms` at 375px — all have consistent spacing, readable line-height, and adequate touch targets already (most controls use the shared `Button`/`Input` components, which default to `h-11`/`h-12`).

**Explicitly out of scope for this pass** (flagging rather than silently skipping): the admin/seller/customer dashboards were not re-reviewed beyond the touch-target grep above — they're internal, desktop-oriented tools and were already covered for horizontal-overflow in the prior session's audit (section on mobile overflow). A dedicated pass there would need real Supabase data to be meaningful, which this sandbox can't reach. `/search` and `/products/[id]` also couldn't be visually verified with real content for the same reason — only their loading states render.

---

*This document is a point-in-time snapshot. It is not kept in sync automatically — re-run the greps above if you need a fresh read after further changes.*
