# Migration

If you installed the plugin before v3.0 (a marketplace rename in PR #22) or
under an older marketplace handle, this guide migrates you to the current
single-plugin layout. **New users do not need anything in this file — just
follow [Quick Start](README.md#quick-start) in the README.**

## Current install handle (since v3.0)

```bash
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

Marketplace name: `agent-review-panel`. Plugin name: `roundtable`. The full
handle is `roundtable@agent-review-panel`.

## Historical handles (and how to clean them up)

| Era | Marketplace name | Plugin handle |
|---|---|---|
| pre-v2.16 | `agent-review-panel` (bare) | `agent-review-panel@agent-review-panel` |
| v2.16.0 | `wan-huiyan-agent-review-panel` | `agent-review-panel@wan-huiyan-agent-review-panel` |
| pre-v2.16.1 | `plugin` (bare) | `agent-review-panel@plugin` |
| v2.16.1 – v2.x | `wan-huiyan-agent-review-panel` | `agent-review-panel@wan-huiyan-agent-review-panel` |
| pre-v3.0 (`plan-review-integrator` was standalone) | `wan-huiyan-plan-review-integrator` | `plan-review-integrator@wan-huiyan-plan-review-integrator` |
| **v3.0+** | **`agent-review-panel`** | **`roundtable@agent-review-panel`** |

## Migrate from any pre-v3.0 install

From your terminal:

```bash
# Remove any pre-v3.0 install (run only the lines that apply to you)
claude plugin uninstall agent-review-panel@wan-huiyan-agent-review-panel
claude plugin marketplace remove wan-huiyan-agent-review-panel
claude plugin uninstall plan-review-integrator@wan-huiyan-plan-review-integrator
claude plugin marketplace remove wan-huiyan-plan-review-integrator

# Install the current bundle (one plugin, both skills)
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

REPL form (inside a Claude Code session, replace `claude plugin` with `/plugin`):

```
/plugin uninstall agent-review-panel@wan-huiyan-agent-review-panel
/plugin marketplace remove wan-huiyan-agent-review-panel
/plugin uninstall plan-review-integrator@wan-huiyan-plan-review-integrator
/plugin marketplace remove wan-huiyan-plan-review-integrator
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install roundtable@agent-review-panel
```

Restart your Claude Code session. Verify:

```bash
ls ~/.claude/plugins/cache/agent-review-panel/
# expected: roundtable  (one plugin dir; both skills live inside it)
```

## Stale-state cleanup (when uninstall isn't enough)

If `claude plugin update` or `install` misbehaves, leftover state from older
marketplace handles may be shadowing the new install. The fastest fix is to
paste this prompt into any Claude Code session and let Claude do the cleanup:

> Install the `agent-review-panel` plugin from `wan-huiyan/agent-review-panel`.
> Before installing:
> 1. Check `~/.claude/plugins/known_marketplaces.json` for any cached registration
>    of this repo under an old name (`plugin`, `wan-huiyan-agent-review-panel`) —
>    if found, `claude plugin marketplace remove <old-name>` first.
> 2. Check `~/.claude/plugins/marketplaces/` for orphan directories with trailing
>    whitespace.
> 3. Check `~/.claude/skills/` for loose-clone shadows of `agent-review-panel`,
>    `agent-review-panel-workspace`, `plan-review-integrator`, or `roundtable` —
>    back up to `*.bak.<timestamp>` then remove.
> 4. Then run `claude plugin marketplace add wan-huiyan/agent-review-panel` and
>    `claude plugin install roundtable@agent-review-panel`.
> 5. Verify the install by listing
>    `~/.claude/plugins/cache/agent-review-panel/roundtable/*/skills/` and confirming
>    both `agent-review-panel/SKILL.md` and `plan-review-integrator/SKILL.md` are
>    present.
> 6. Remind me to restart my Claude Code session.
> Report each step's outcome.

Claude will ask you to confirm any destructive `rm` actions before running them.

Manual bash equivalent:

```bash
# Old marketplace name (pre-v2.16.1 was "plugin")
claude plugin marketplace remove plugin 2>/dev/null

# Orphan marketplace dirs (sometimes have trailing whitespace in the name)
rm -rf "$HOME/.claude/plugins/marketplaces/wan-huiyan-agent-review-panel "  # note trailing space
rm -rf "$HOME/.claude/plugins/marketplaces/wan-huiyan-agent-review-panel"   # no space

# Loose-clone shadows from pre-marketplace-era manual clones
rm -rf "$HOME/.claude/skills/agent-review-panel" \
       "$HOME/.claude/skills/agent-review-panel-workspace" \
       "$HOME/.claude/skills/plan-review-integrator" \
       "$HOME/.claude/skills/roundtable"

# Fresh install
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

Restart your Claude Code session after install.

## v3.0 layout change

Pre-v3.0 the marketplace shipped two independently-installable plugins
(`roundtable` + `plan-review-integrator`). v3.0 collapses them into one plugin
(`roundtable`) bundling both skills, mirroring [obra/superpowers](https://github.com/obra/superpowers).
If you previously ran `claude plugin install plan-review-integrator@agent-review-panel`,
install just `roundtable@agent-review-panel` and you'll get both skills.
