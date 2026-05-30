# Agent Instructions & Project Rules

This document outlines the essential core rules and customization behaviors that MUST be respected across all coding agent sessions for this application:

## 1. Authentication & GitHub Integration
- **MANDATORY**: Always keep **GitHub Sign-In** integrated and accessible as a login option. This ensures seamless support for syncing, code tracking, and continuous application updates via GitHub.
- Keep the `GithubAuthProvider` login action active in `src/pages/Login.tsx`, and never revert or disable the GitHub Sign-In mechanism.

## 2. Urdu Typography & Layout
- **MANDATORY**: Ensure the Urdu font "**Jameel Noori Nastaleeq**" (paired with "**Noto Nastaliq Urdu**" as fallback) is configured across the application.
- The default UI display fonts (`--font-sans` and `--font-display` in `@theme` standard CSS variables in `index.css`) must include "Jameel Noori Nastaleeq" and "Noto Nastaliq Urdu" so that Urdu writing has authentic, beautiful calligraphic rendering everywhere.
- Use the `.urdu-font` helper class wherever Urdu text is wrapped or printed.
