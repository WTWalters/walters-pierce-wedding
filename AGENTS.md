# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: Primary Development Document

**Please refer to `CLAUDE_CODE_HANDOFF.md` for complete development instructions.**

That document contains:
- Complete project specifications
- Development priorities
- Technical architecture
- Step-by-step implementation guide
- All feature requirements

## Quick Project Summary

**Project:** Wedding website for Emme & Connor (September 2026)  
**Current Status:** Live in production at https://walters-pierce-wedding.com — Next.js app with RSVP, guest management, photos, registry and email all shipped  
**Next Step:** See the top of the memory note `wedding-site-open-threads` for what's actually outstanding  
**Key Documents:**
- `CLAUDE_CODE_HANDOFF.md` - Main development guide ⭐
- `docs/FEATURE_PLAN.md` - Complete feature list
- `docs/database_schema.sql` - PostgreSQL schema
- `docs/QUICK_START.md` - Setup instructions

## Technology Stack

- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS  
- **Database:** PostgreSQL on Railway
- **ORM:** Prisma
- **Auth:** NextAuth.js
- **Deployment:** Railway

## Design Requirements

- **Primary Color:** #00330a (Forest Green)
- **Accent Color:** #D4AF37 (Gold)
- **Fonts:** Playfair Display (headers), Montserrat (body), Cormorant Garamond (accents)

## Start Development

```bash
# See CLAUDE_CODE_HANDOFF.md for complete instructions
cat CLAUDE_CODE_HANDOFF.md
```