#!/usr/bin/env node
/**
 * PostToolUse hook: after Claude edits a JSON file inside a Remora project, run `remora compile` and
 * hand any errors back to Claude, so a broken config is fixed in the same turn instead of surfacing
 * at the next run.
 *
 * Silent (exit 0) whenever there is nothing to say: the file is not part of a Remora project, the
 * CLI is not installed, or the project compiles. Exit 2 puts stderr in front of Claude.
 *
 * Node builtins only, so the plugin needs no install step.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'

const COMPILE_TIMEOUT_MS = 50_000
const MAX_REPORT_CHARS = 8_000

const readInput = () => {
    try {
        return JSON.parse(readFileSync(0, 'utf-8'))
    } catch {
        return null
    }
}

/**
 * The `remora/` folder holding this file, or null. A Remora project is a folder named `remora` with
 * a `project.json`; `compile` must run from the folder that contains it.
 */
const findProjectFolder = filePath => {
    let dir = dirname(filePath)
    while (true) {
        if (basename(dir) === 'remora' && existsSync(join(dir, 'project.json'))) return dir
        const parent = dirname(dir)
        if (parent === dir) return null
        dir = parent
    }
}

/** A local install wins over a global one, so the project compiles with the CLI it pins. */
const findCli = projectRoot => {
    const bin = process.platform === 'win32' ? 'remora.cmd' : 'remora'
    const local = join(projectRoot, 'node_modules', '.bin', bin)
    return existsSync(local) ? local : bin
}

/** The errors out of `compile --json`, one JSON object per line; anything else on stdout is skipped. */
const collectErrors = stdout => {
    const errors = []
    for (const line of stdout.split('\n')) {
        let event
        try {
            event = JSON.parse(line)
        } catch {
            continue
        }
        if (event?.type === 'message' && event.kind === 'error')
            errors.push([event.text, ...(event.detail ?? []).map(x => `  ${x}`)].join('\n'))
        else if (event?.type === 'log' && event.level === 'error')
            errors.push(event.message)
    }
    return errors
}

const main = () => {
    const input = readInput()
    const filePath = input?.tool_input?.file_path ?? input?.tool_response?.filePath
    if (!filePath || !filePath.endsWith('.json')) return 0

    const projectFolder = findProjectFolder(filePath)
    if (!projectFolder) return 0

    // Run scratch space (.temp, .synth) is written by Remora itself, not configuration.
    if (relative(projectFolder, filePath).split(sep).some(part => part.startsWith('.'))) return 0

    const projectRoot = dirname(projectFolder)
    const result = spawnSync(findCli(projectRoot), ['compile', '--json'], {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: COMPILE_TIMEOUT_MS,
        shell: process.platform === 'win32',
        env: { REMORA_RUNTIME_CONTEXT: 'cli', ...process.env }
    })

    // Not installed, or did not finish: nothing reliable to report.
    if (result.error || result.status === null || result.status === 0) return 0

    const errors = collectErrors(result.stdout ?? '')
    const body = errors.length
        ? errors.join('\n')
        : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

    const report = `remora compile failed after editing ${relative(projectRoot, filePath)}:\n${body}`
    process.stderr.write(report.length > MAX_REPORT_CHARS
        ? `${report.slice(0, MAX_REPORT_CHARS)}\n… (truncated, run remora compile for the rest)\n`
        : `${report}\n`)
    return 2
}

process.exit(main())
