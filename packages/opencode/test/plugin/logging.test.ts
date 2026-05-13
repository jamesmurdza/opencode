import { describe, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import path from "path"
import { pathToFileURL } from "url"
import { Account } from "../../src/account/account"
import { Auth } from "../../src/auth"
import { Bus } from "../../src/bus"
import { Config } from "../../src/config/config"
import { Env } from "../../src/env"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Plugin } from "../../src/plugin/index"
import { provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { NpmTest } from "../fake/npm"

const emptyAccount = Layer.mock(Account.Service)({
  active: () => Effect.succeed(Option.none()),
  activeOrg: () => Effect.succeed(Option.none()),
})
const emptyAuth = Layer.mock(Auth.Service)({
  all: () => Effect.succeed({}),
})
const configLayer = Config.layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(AppFileSystem.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(emptyAuth),
  Layer.provide(emptyAccount),
  Layer.provide(NpmTest.noop),
)
const it = testEffect(
  Layer.mergeAll(
    Plugin.layer.pipe(
      Layer.provide(Bus.layer),
      Layer.provide(configLayer),
      Layer.provide(RuntimeFlags.layer({ disableDefaultPlugins: true })),
    ),
    CrossSpawnSpawner.defaultLayer,
  ),
)

describe("plugin.logging", () => {
  it.live("plugin receives log object with all log methods", () =>
    provideTmpdirInstance((dir) =>
      Effect.gen(function* () {
        const file = path.join(dir, "plugin.ts")
        const mark = path.join(dir, "log-check.json")

        // Plugin that verifies the log object has all expected methods
        yield* Effect.promise(() =>
          Bun.write(
            file,
            [
              "export default async ({ log }) => {",
              "  const hasDebug = typeof log.debug === 'function'",
              "  const hasInfo = typeof log.info === 'function'",
              "  const hasWarn = typeof log.warn === 'function'",
              "  const hasError = typeof log.error === 'function'",
              `  await Bun.write(${JSON.stringify(mark)}, JSON.stringify({`,
              "    hasDebug,",
              "    hasInfo,",
              "    hasWarn,",
              "    hasError,",
              "  }))",
              "  return {}",
              "}",
              "",
            ].join("\n"),
          ),
        )

        yield* Effect.promise(() =>
          Bun.write(
            path.join(dir, "opencode.json"),
            JSON.stringify(
              {
                $schema: "https://opencode.ai/config.json",
                plugin: [pathToFileURL(file).href],
              },
              null,
              2,
            ),
          ),
        )

        const plugin = yield* Plugin.Service
        yield* plugin.init()

        const result = JSON.parse(yield* Effect.promise(() => Bun.file(mark).text()))
        expect(result.hasDebug).toBe(true)
        expect(result.hasInfo).toBe(true)
        expect(result.hasWarn).toBe(true)
        expect(result.hasError).toBe(true)
      }),
    ),
  )

  it.live("plugin can call log methods without errors", () =>
    provideTmpdirInstance((dir) =>
      Effect.gen(function* () {
        const file = path.join(dir, "plugin.ts")
        const mark = path.join(dir, "log-success.json")

        // Plugin that calls all log methods
        yield* Effect.promise(() =>
          Bun.write(
            file,
            [
              "export default async ({ log }) => {",
              "  try {",
              '    log.debug("debug message", { level: "debug" })',
              '    log.info("info message", { level: "info" })',
              '    log.warn("warning message", { level: "warn" })',
              '    log.error("error message", { level: "error" })',
              `    await Bun.write(${JSON.stringify(mark)}, JSON.stringify({ success: true }))`,
              "  } catch (err) {",
              `    await Bun.write(${JSON.stringify(mark)}, JSON.stringify({ success: false, error: err.message }))`,
              "  }",
              "  return {}",
              "}",
              "",
            ].join("\n"),
          ),
        )

        yield* Effect.promise(() =>
          Bun.write(
            path.join(dir, "opencode.json"),
            JSON.stringify(
              {
                $schema: "https://opencode.ai/config.json",
                plugin: [pathToFileURL(file).href],
              },
              null,
              2,
            ),
          ),
        )

        const plugin = yield* Plugin.Service
        yield* plugin.init()

        const result = JSON.parse(yield* Effect.promise(() => Bun.file(mark).text()))
        expect(result.success).toBe(true)
      }),
    ),
  )

  it.live("plugin log methods work without extra parameter", () =>
    provideTmpdirInstance((dir) =>
      Effect.gen(function* () {
        const file = path.join(dir, "plugin.ts")
        const mark = path.join(dir, "log-no-extra.json")

        // Plugin that calls log methods without extra parameter
        yield* Effect.promise(() =>
          Bun.write(
            file,
            [
              "export default async ({ log }) => {",
              "  try {",
              '    log.debug("debug message only")',
              '    log.info("info message only")',
              '    log.warn("warning message only")',
              '    log.error("error message only")',
              `    await Bun.write(${JSON.stringify(mark)}, JSON.stringify({ success: true }))`,
              "  } catch (err) {",
              `    await Bun.write(${JSON.stringify(mark)}, JSON.stringify({ success: false, error: err.message }))`,
              "  }",
              "  return {}",
              "}",
              "",
            ].join("\n"),
          ),
        )

        yield* Effect.promise(() =>
          Bun.write(
            path.join(dir, "opencode.json"),
            JSON.stringify(
              {
                $schema: "https://opencode.ai/config.json",
                plugin: [pathToFileURL(file).href],
              },
              null,
              2,
            ),
          ),
        )

        const plugin = yield* Plugin.Service
        yield* plugin.init()

        const result = JSON.parse(yield* Effect.promise(() => Bun.file(mark).text()))
        expect(result.success).toBe(true)
      }),
    ),
  )
})
