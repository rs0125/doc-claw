import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Direct (non-pooled) connection — used by Migrate/CLI only.
    url: process.env.DIRECT_URL ?? "",
  },
});
