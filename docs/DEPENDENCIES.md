# Dependency policy

Direct dependencies were selected for permissive licensing and local execution. The lockfile records exact installed versions. Do not ship without retaining dependency license notices required by their packages.

| Dependency                 | Role                                 | License    |
| -------------------------- | ------------------------------------ | ---------- |
| React / React DOM          | Studio UI                            | MIT        |
| Zod                        | Runtime schemas                      | MIT        |
| @xmldom/xmldom             | SVG XML inspection                   | MIT        |
| lucide-react               | Studio interface icons               | ISC        |
| @modelcontextprotocol/sdk  | MCP stdio server/client protocol     | MIT        |
| TypeScript                 | Type checking                        | Apache-2.0 |
| Vite / plugin-react        | Local development and web bundling   | MIT        |
| Vitest                     | Automated tests                      | MIT        |
| Playwright                 | Chromium snapshots and browser tests | Apache-2.0 |
| tsx                        | TypeScript source execution          | MIT        |
| ESLint / typescript-eslint | Lint checks                          | MIT        |
| pnpm                       | Workspace package manager            | MIT        |

| Prettier | Source formatting | MIT |

Playwright's downloaded Chromium/FFmpeg binaries have their own upstream notices; they are development/runtime tools and are not bundled into exported SVG/JSON or the standalone web module. No fonts, trackers, hosted assets or model APIs are fetched by the running Studio.
