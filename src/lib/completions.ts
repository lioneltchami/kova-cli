export interface CommandInfo {
  name: string;
  description: string;
  options: Array<{ flags: string; description: string }>;
}

export function getCommandRegistry(): CommandInfo[] {
  return [
    {
      name: "init",
      description: "Initialize a project for orchestrated development",
      options: [
        {
          flags: "--force",
          description: "Overwrite existing .claude/ directory",
        },
        { flags: "--merge", description: "Merge with existing .claude/ files" },
        {
          flags: "--dry-run",
          description: "Show what would be created without creating",
        },
        { flags: "--no-detect", description: "Skip auto-detection" },
        { flags: "--preset", description: "Use a preset configuration" },
      ],
    },
    {
      name: "plan",
      description: "Create an implementation plan",
      options: [
        { flags: "--model", description: "Override planning model" },
        {
          flags: "--auto-build",
          description: "Skip approval, immediately build",
        },
        { flags: "--output", description: "Custom output path" },
        { flags: "--template", description: "Use a plan template" },
        { flags: "--issue", description: "Link a GitHub issue for context" },
        { flags: "--no-branch", description: "Disable auto-branch creation" },
      ],
    },
    {
      name: "run",
      description: "Plan and build in one step",
      options: [
        { flags: "--model", description: "Override planning model" },
        { flags: "--template", description: "Use a plan template" },
        { flags: "--no-auto", description: "Pause for approval" },
        { flags: "--live", description: "Show real-time progress" },
        { flags: "--resume", description: "Resume from checkpoint" },
        { flags: "--verbose", description: "Show agent output" },
        { flags: "--issue", description: "Link a GitHub issue for context" },
        { flags: "--branch", description: "Custom branch name" },
        { flags: "--no-branch", description: "Disable auto-branch creation" },
      ],
    },
    {
      name: "build",
      description: "Execute a plan using sub-agent dispatch",
      options: [
        { flags: "--resume", description: "Resume from checkpoint" },
        { flags: "--parallel", description: "Max parallel agents" },
        {
          flags: "--model-override",
          description: "Use this model for all tasks",
        },
        { flags: "--dry-run", description: "Show execution plan" },
        { flags: "--verbose", description: "Show agent output" },
        { flags: "--no-validate", description: "Skip validation step" },
        { flags: "--live", description: "Show real-time progress" },
      ],
    },
    {
      name: "team-build",
      description: "Execute a plan using Agent Teams coordination",
      options: [
        { flags: "--resume", description: "Resume from checkpoint" },
        { flags: "--parallel", description: "Max parallel agents" },
        {
          flags: "--model-override",
          description: "Use this model for all tasks",
        },
        { flags: "--dry-run", description: "Show execution plan" },
        { flags: "--verbose", description: "Show agent output" },
        { flags: "--no-validate", description: "Skip validation step" },
        { flags: "--wave-timeout", description: "Max time per wave" },
        { flags: "--live", description: "Show real-time progress" },
      ],
    },
    {
      name: "status",
      description: "Check progress of current or recent builds",
      options: [],
    },
    {
      name: "config",
      description: "View or edit Kova configuration",
      options: [],
    },
    {
      name: "update",
      description: "Update scaffolded templates",
      options: [
        { flags: "--force", description: "Overwrite locally modified files" },
      ],
    },
    {
      name: "pr",
      description: "Create a GitHub Pull Request from the last build",
      options: [
        { flags: "--title", description: "Override PR title" },
        { flags: "--body", description: "Override PR body" },
        { flags: "--draft", description: "Create as draft PR" },
        { flags: "--base", description: "Target branch" },
      ],
    },
    {
      name: "completions",
      description: "Generate shell completion scripts",
      options: [],
    },
  ];
}

export function generateBashCompletion(): string {
  const commands = getCommandRegistry();
  const cmdNames = commands.map((c) => c.name).join(" ");

  let script = `#!/bin/bash
# Kova CLI bash completions
# Add to ~/.bashrc: eval "$(kova completions bash)"

_kova_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${cmdNames}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
`;

  for (const cmd of commands) {
    if (cmd.options.length > 0) {
      const flags = cmd.options.map((o) => o.flags).join(" ");
      script += `    ${cmd.name})\n      COMPREPLY=( $(compgen -W "${flags}" -- "\${cur}") )\n      ;;\n`;
    }
  }

  script += `  esac
}

complete -F _kova_completions kova
`;
  return script;
}

export function generateZshCompletion(): string {
  const commands = getCommandRegistry();

  let script = `#compdef kova
# Kova CLI zsh completions
# Add to ~/.zshrc: eval "$(kova completions zsh)"

_kova() {
  local -a commands
  commands=(
`;

  for (const cmd of commands) {
    script += `    '${cmd.name}:${cmd.description}'\n`;
  }

  script += `  )

  _arguments -C \\
    '1:command:->command' \\
    '*::options:->options'

  case $state in
    command)
      _describe 'kova command' commands
      ;;
    options)
      case $words[1] in
`;

  for (const cmd of commands) {
    if (cmd.options.length > 0) {
      script += `        ${cmd.name})\n          _arguments \\\n`;
      for (const opt of cmd.options) {
        script += `            '${opt.flags}[${opt.description}]' \\\n`;
      }
      script += `          ;;\n`;
    }
  }

  script += `      esac
      ;;
  esac
}

_kova "$@"
`;
  return script;
}

export function generateFishCompletion(): string {
  const commands = getCommandRegistry();

  let script = `# Kova CLI fish completions
# Save to: ~/.config/fish/completions/kova.fish

# Disable file completions
complete -c kova -f

# Commands
`;

  for (const cmd of commands) {
    script += `complete -c kova -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"\n`;
  }

  script += `\n# Command options\n`;

  for (const cmd of commands) {
    for (const opt of cmd.options) {
      const flag = opt.flags.replace(/^--/, "");
      script += `complete -c kova -n "__fish_seen_subcommand_from ${cmd.name}" -l "${flag}" -d "${opt.description}"\n`;
    }
  }

  // Add template completions for plan and run
  script += `\n# Template completions\n`;
  const templates = [
    "feature",
    "bugfix",
    "refactor",
    "migration",
    "security",
    "performance",
  ];
  for (const t of templates) {
    script += `complete -c kova -n "__fish_seen_subcommand_from plan" -l "template" -xa "${t}"\n`;
    script += `complete -c kova -n "__fish_seen_subcommand_from run" -l "template" -xa "${t}"\n`;
  }

  return script;
}
